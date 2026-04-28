from typing import Optional 
from pydantic import Basemodel,Field,field_validator,model_validator,computed_field

Basemodel
class Courses(Basemodel):
    id: Optional[int]= None
    title: str = Field(min_length=2,max_length=100,description="Course Title")
    instructor: str = Field(min_length=2,max_length=50,description="Name of the instructor")
    category : str = Field(min_length=2 , max_length=100, description="Category of the course")
    price : float = Field(ge=0,le=10_000,description="Price of th course")
    duration_hours : int = Field(ge=1,le=1000,description="Time Duration of course")
    is_published : bool = Field(description="Published Stauts of course",default=True)
    discount_percent : float = Field(ge=0,le=100,description="Discount Percent on course")

@field_validator("title")
@classmethod
def clean_title(cls,value:str)->str:
    return value.title()

@field_validator("instructor")
@classmethod
def instructor_name(cls,value:str)->str:
    return value.title()

@field_validator("category")
@classmethod
def clean_categry(cls,value:str)->str:
    return value.lower()

@model_validator()
@classmethod
def check_published_discount(self):
    if self.is_published == False & self.discount_percent >=0.0:
        raise ValueError ("Unpublished courses cannot have discount")
    return self

@computed_field
@property
def price_category(self)->str:
      if self.price<599:
         return "Budget"
      elif self.price<999:
         return "Mid-range"
      else:
         return "Premium"