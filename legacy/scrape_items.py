from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import pandas as pd
import json
from google.cloud.sql.connector import Connector
import pymysql
from sqlalchemy import create_engine
import os
# pip install python-dotenv
from dotenv import load_dotenv
load_dotenv()
import sys
# pip install "cloud-sql-python-connector[pymysql]"

chrome_options = Options()
chrome_options.add_argument("--headless")
driver = webdriver.Chrome(options=chrome_options)
loblaw_items = []

location = sys.argv[1]
url = f"https://backflipp.wishabi.com/flipp/items/search?locale=en-ca&postal_code=${location}&q=loblaws"
driver.get(url)
time.sleep(2)

body = WebDriverWait(driver, 10).until(
    EC.presence_of_element_located((By.TAG_NAME, "body"))
)

text = body.text

parsed_data = json.loads(text)
items_data = parsed_data["items"] if len(parsed_data["items"]) != 0 else parsed_data["related_items"]
for d in items_data: 
    loblaw_item = {
        "item_id": d["id"], 
        "item_name": d["name"],
        "sale_story": d["sale_story"], # Where the extra points are located
        "image": d["clean_image_url"],
        "valid_from": d["valid_from"],
        "valid_to": d["valid_to"],
        "categories": d["_L2"] if "_L2" in d.keys() else None,
        "price": d["current_price"]
    }
    loblaw_items.append(loblaw_item)

df = pd.DataFrame(loblaw_items)
food_df = df.copy()
food_df = food_df.dropna(subset=['price'])
# Can do some filtering here
food_df = food_df.loc[food_df['categories'].isin(('Food Items', 'Beverages'))]

# Can also do some try to extract the extra points here for the optimization thing

# Drop categories
food_df.drop(columns=['categories'], axis=1, inplace=True)

# Load the data into the database here!
connector = Connector()

def getconn():
    conn: pymysql.connections.Connection = connector.connect(
        "sonorous-sign-429909-i9:northamerica-northeast2:mysql-instance", 
        "pymysql", 
        user = os.getenv('CLOUD_USER'), 
        password = os.getenv('CLOUD_PASSWORD'), 
        db = os.getenv("CLOUD_DB_NAME")
    )
    return conn
# create connection pool
pool = create_engine(
    "mysql+pymysql://",
    creator=getconn
)

food_df.to_sql(name='items', con=pool, if_exists='append', index=False)
print("Food successfully loaded into items table!")