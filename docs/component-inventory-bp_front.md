# Component Inventory — bp_front

## Layout Components

| Component    | File                 | Type   | Description                                                                         |
|--------------|----------------------|--------|-------------------------------------------------------------------------------------|
| `RootLayout` | `app/layout.tsx`     | Server | Root HTML shell: MUI ThemeProvider, AppRouterCacheProvider, AppHeader, content area |
| `AppHeader`  | `app/AppHeader.tsx`  | Server | MUI AppBar with app title ("Bag please") and Navigation component                   |
| `Navigation` | `app/Navigation.tsx` | Client | Hamburger dropdown menu with context-sensitive nav items                            |

### Navigation Menu Items

- **Home** — always visible, routes to `/`
- **To Buy List** — always visible, routes to `/store`
- **Item Management** — visible only when path starts with `/store`
- **Categories** — visible only when path starts with `/store`
- **Logout** — always visible via `Logout` component

---

## Auth Components

| Component   | File                  | Type   | Description                                                        |
|-------------|-----------------------|--------|--------------------------------------------------------------------|
| `LoginPage` | `app/auth/page.tsx`   | Client | Login form: username + password text fields, submit via IconButton |
| `Logout`    | `app/auth/Logout.tsx` | Client | MenuItem that clears localStorage and redirects to `/auth`         |

**Auth flow:** `LoginPage` calls `POST /api/login`, stores JWT + username in `localStorage`, then navigates to `/`.
`ApolloWrapper` reads the token on every GQL request. Network errors trigger `onAuthError()` → redirect to `/auth`.

---

## Infrastructure Components

| Component       | File                           | Type   | Description                                                                      |
|-----------------|--------------------------------|--------|----------------------------------------------------------------------------------|
| `ApolloWrapper` | `lib/apollo/ApolloWrapper.tsx` | Client | Provides Apollo client to the entire tree; splits HTTP vs WebSocket; injects JWT |

`ApolloWrapper` takes an `onAuthError` callback from its parent — on network/auth errors it calls back to let the parent
redirect to `/auth`. It must wrap all components that use Apollo hooks.

---

## Store — Data Display Components

| Component           | File                          | Type   | Description                                                                                       |
|---------------------|-------------------------------|--------|---------------------------------------------------------------------------------------------------|
| `Home` (store page) | `app/store/page.tsx`          | Client | To Buy List page: renders `ItemsList` + floating Add FAB                                          |
| `ItemsList`         | `app/store/ItemsList.tsx`     | Client | Main list component: fetches items + categories, renders grouped by category with search + filter |
| `ItemView`          | `app/store/ItemView.tsx`      | Client | Single item row: MUI Checkbox + label; fires `saveItem` mutation on check/uncheck                 |
| `ManageCategories`  | `app/store/category/page.tsx` | Client | Category management table: MUI Table with search + FAB, `subscribeToMore` for real-time           |

### ItemsList Details

- Queries `getItems` + `getCategories`
- Subscribes to `itemsSubscription` via `subscribeToMore`
- Renders items grouped under their category name
- Immutable.js `List` used for sort (alphabetical by name, then id) and dual filter (checked status + search text)
- Items without a matching category are not rendered (silently dropped)

---

## Store — Form / Dialog Components

| Component        | File                                    | Type   | Description                                                                 |
|------------------|-----------------------------------------|--------|-----------------------------------------------------------------------------|
| `CreateItem`     | `app/store/item/CreateItem.tsx`         | Client | Dialog for create/edit/delete item; name field + category picker            |
| `CreateCategory` | `app/store/category/CreateCategory.tsx` | Client | Dialog for create/edit/delete category; name field only                     |
| `SelectCategory` | `app/store/category/SelectCategory.tsx` | Client | Controlled Select dropdown; queries categories and displays them as options |

### Dialog Pattern (shared by CreateItem + CreateCategory)

- Opens when `item`/`category` prop is defined (controlled by parent `useState`)
- `isNew` flag controls whether the Delete button is shown
- `onClose()` callback resets parent state → closes dialog
- On Save: fires mutation + calls `onClose()`
- On Delete: fires delete mutation + calls `onClose()`

---

## MUI Component Usage Summary

| MUI Component                                                                | Used In                                |
|------------------------------------------------------------------------------|----------------------------------------|
| `AppBar`, `Toolbar`                                                          | AppHeader                              |
| `Box`, `Paper`, `Stack`                                                      | Most pages and dialogs                 |
| `Typography`                                                                 | Throughout                             |
| `Fab`                                                                        | Store page, Category page (Add button) |
| `Dialog`                                                                     | CreateItem, CreateCategory             |
| `TextField`                                                                  | LoginPage, CreateItem, CreateCategory  |
| `Checkbox`, `FormControlLabel`, `FormGroup`                                  | ItemView                               |
| `Select`, `MenuItem`, `InputLabel`, `FormControl`                            | ItemsList (filter), SelectCategory     |
| `OutlinedInput`, `InputAdornment`, `IconButton`                              | ItemsList (search), Category page      |
| `Table`, `TableHead`, `TableBody`, `TableRow`, `TableCell`, `TableContainer` | Category page                          |
| `Button`, `ButtonGroup`                                                      | CreateItem, CreateCategory             |
| `Menu`, `MenuItem`, `Divider`                                                | Navigation                             |
| `CssBaseline`                                                                | Root layout                            |

---

## GraphQL Operations Inventory

| File                       | Export                   | Operation Type | GQL Operation                            |
|----------------------------|--------------------------|----------------|------------------------------------------|
| `lib/item/Queries.tsx`     | `getItemsQuery`          | query          | `getItems { id name checked category }`  |
| `lib/item/Queries.tsx`     | `createItemMutation`     | mutation       | `saveItem(item: ItemInput!)`             |
| `lib/item/Queries.tsx`     | `deleteItemMutation`     | mutation       | `deleteItem(id: ID!)`                    |
| `lib/item/Queries.tsx`     | `itemsSubscription`      | subscription   | `getItemUpdates { type, item }`          |
| `lib/category/Queries.tsx` | `getCategoriesQuery`     | query          | `getCategories { id name }`              |
| `lib/category/Queries.tsx` | `createCategoryMutation` | mutation       | `saveCategory(category: CategoryInput!)` |
| `lib/category/Queries.tsx` | `deleteCategoryMutation` | mutation       | `deleteCategory(id: ID!)`                |
| `lib/category/Queries.tsx` | `categoriesSubscription` | subscription   | `getCategoryUpdates { type, item }`      |
