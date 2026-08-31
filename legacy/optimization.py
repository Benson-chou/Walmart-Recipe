# minimize cost = sum(1~n) c_i x x_i
# Where x_i is whether buy item i or not
# Constraints: 
    # Lower than budget
# pip install pulp 
import pulp
import sys
import ast
output = {}
items = ast.literal_eval(sys.argv[1])
costs = ast.literal_eval(sys.argv[2])
budget = int(sys.argv[3])

groceries = dict(zip(items, costs))

# Create a Linear Programming problem
prob = pulp.LpProblem("Grocery_Cost_Optimization", pulp.LpMaximize)

# Define decision variables for each grocery item
item_vars = {item: pulp.LpVariable(item, lowBound=1, cat='Integer') for item in groceries}

# Objective function: Minimize total cost
prob += pulp.lpSum([groceries[item] * item_vars[item] for item in groceries])

# Can add More Constraints
# Lower than budget
prob += pulp.lpSum([groceries[item] * item_vars[item] for item in groceries]) <= budget

prob.solve()
opt = prob.objective.value()
if prob.objective.value() >= opt: 
    for item in groceries: 
        output[item] = item_vars[item].value()
print("hi")
print(output)