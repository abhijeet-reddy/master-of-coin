design a finance tracker application, which has front end and backend. 

Front end is React
Back end is Rust (&docker)

help me pick a good UI library as well, I want it snappy visually rich and attractive. It should be good with financial graphs.

Application details:
It'a finance tracker, which has accounts, transactions, catogries, budgets, people

### Account
Represents a bank account/credit card account/stock account. Should have a name

### Transaction
Represents actual transactions done in the accounts. All the transactions should be associated with an account. Should have a title, amount, date & time.

Sometimes the transaction is paid for a group. Sometimes the whole transaciton is paid on behalf of someone else. So we should be able to represent how much is my spend and how much of it is paid for each of the other person. This will also help us track how much each person owes me.

### Catogery
Represents catogeries like food, entertainment, ....

### Budget
Represents a group of transactions, which can be auto grouped based on certain filters. Can set some limits each month and see how we are doing.

### People
Represents people, who can be added to a transaction

Note: None of the categories,accounts.... is created. User has the full flexibility over it.


## Backend:
Decide best database for this kind of application, come up with proper database design.

Factors:
- It'll be only used by 1-2 people
- Good aggregation as we need to to build dashboards and all
- transactions can grow huge soon, so we need to be able to scale. Select the Database accordingly.


## Frontend:
React with functional hooks.

*Key design patterns:*
- Use simple components, hooks
- Do not write too much logic in component, use hooks to have all the logic
- Each hook should only have maximum of one useState hook
- Each hook should only have maximum of one useEffect hook, try not to use useEffect as much as possible.