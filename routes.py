from fastapi import APIRouter , HTTPException , FastAPI,Query
from pydantic import BaseModel,computed_field
from utils import read_data,write_data
from typing import Optional

route = APIRouter()
app = FastAPI()


@route.get("/")
def msg():
    return {"message":"welcome to my api"}

@route.get("/courses")
def get_courses():
    data=read_data()
    return data

@route.get("/courses/paginated")
def get_courses(
    page:int = Query(1,ge=1),
    limit : int = Query(10,ge=1,le=100)
):
    data = read_data()
    start = (page-1)*limit
    end = start + limit
    return {
        "total_courses": len(data),
        "page": page,
        "limit": limit,
        "courses": data[start:end]
    }

@route.get("/courses/{id}")
def get_course_by_id(id:int):
    data=read_data()
    course_id = [i for i in data if i["id"]==id]
    if not course_id:
        raise HTTPException(status_code=404,detail="Course ID not found")
    return course_id

#                                         ***  POST  ***
class Course(BaseModel):
    id : Optional[int]=None
    title : str
    instructor :str
    category : str
    price :int
    duration_hours : float
    is_published : str
    discount_percent : float

@route.post("/create_course")
def create_course(course:Course):
    data=read_data()
    new_id = max([i["id"] for i in data]) +1 if data else 1
    new_course = course.dict()
    new_course["id"] = new_id
    data.append(new_course)
    write_data(data)
    return {"message":"Course created successfully"}

#                                       ***  PUT(update)  ***
@route.put("/update_course/{id}")
def update_course(id:int,course:Course):
    data=read_data()
    course_index=0
    for i , course_id in enumerate(data):
        if course_id["id"]==id:
            course_index=i
    updated_course = course.dict()
    updated_course["id"]=id
    data[course_index]=updated_course
    write_data(data)
    return {"message":"Course updated successfully"}

#                                       ***  DELETE  ***
@route.delete('/delete_course/{id}')
def delete_course(id:int):
    try:
        data=read_data()
        course_index=None
        for i , course_id in enumerate(data):
            if course_id["id"]==id:
                course_index=i
                break
        data.pop(course_index)
        write_data(data)
        return {"message":"Course deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=404,detail="Course ID not found")
    
#                                       ***  GET with query parameters  ***
@route.get("/query_courses")
def filter_courses(
    title: Optional[str] = Query(None, description="Filter according to title"),
    instructor: Optional[str] = Query(None, description="Filter according to instructor"),  
    category: Optional[str] = Query(None, description="Filter according to category"),
    min_price: Optional[int] = Query(None, description="Filter according to minimum price"),
    max_price: Optional[int] = Query(None, description="Filter according to maximum price"), 
    duration_hours: Optional[float] = Query(None, description="Filter according to duration hours"),
    is_published: Optional[bool] = Query(None, description="Filter according to publication status"),
    discount_percent: Optional[float] = Query(None, description="Filter according to discount percentage")  
):
    
    data = read_data()
    if title:
        data = [i for i in data if i["title"] == title]
    if instructor:
        data = [i for i in data if i["instructor"] == instructor]
    if category:
        data = [i for i in data if i["category"] == category]
    if duration_hours:
        data = [i for i in data if i["duration_hours"] == duration_hours]
    if min_price:
        data = [i for i in data if i["price"] <= min_price ]
    if max_price:
        data = [ i for i in data if i["price"] >= max_price]
    if is_published :
        data = [ i for i in data if i["is_published"] == is_published]
    if discount_percent:
        data = [ i for i in data if i["discount_percent"] == discount_percent]

    return {"filtered_courses": data}

# @route.get("/courses/paginated")
# def get_courses(
#     page:int = Query(1,ge=1),
#     limit : int = Query(10,ge=1,le=100)
# ):
#     data = read_data()
#     start = (page-1)*limit
#     end = start + limit
#     return {
#         "total_courses": len(data),
#         "page": page,
#         "limit": limit,
#         "courses": data[start:end]
#     }

#in annotation defin data type symbol (->)
@computed_field
@property
def price_category(self)->str:
      if self.price<599:
         return "Budget"
      elif self.price<999:
         return "Mid-range"
      else:
         return "Premium"

    



