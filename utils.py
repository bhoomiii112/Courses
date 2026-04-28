import json
def read_data():
    with open ("courses.json",'r') as fs:
        data = json.load(fs)
        return data
read_data()

def write_data(data):
    with open ("courses.json","w") as fs:
        json.dump(data,fs)
        