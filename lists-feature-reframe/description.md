# steps

1. create new vite project with material ui
2. add caddy run configuration with api and websocket routing to backend
3. create a new auth page
4. create a new user page
5. create a new user-management admin page
6. create a lists management page
    1. manage lists add/remove
    2. mange list categories add/remove
    3. manage list items add/remove
7. create list view page – list of items, check/uncheck feature
    1. filters by category, by checked status, by search
8. share list with other user.
    1. add user to list (all permisions but list delete - only owner can delete)
    2. remove user from list - only owner can remove user
    3. user may decline invitation to list

# rules

1. Every feature should have e2e test in real browser
    1. Before writing test - manually check it with real brower, to discover test case steps and walidate it is working
    2. use playwright to write e2e tests (real browser)
2. try to avoid touching backend code, only after confirming with user
