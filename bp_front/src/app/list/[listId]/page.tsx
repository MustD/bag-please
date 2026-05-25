'use client'

import {useEffect, useRef, useState} from 'react'
import {useParams, useRouter} from 'next/navigation'
import {useMutation, useQuery} from '@apollo/client/react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Snackbar from '@mui/material/Snackbar'
import Button from '@mui/material/Button'
import Fab from '@mui/material/Fab'
import AddIcon from '@mui/icons-material/Add'
import InboxIcon from '@mui/icons-material/Inbox'
import ListIcon from '@mui/icons-material/List'

import {SRProvider, useSR} from '@/contexts/SRContext'
import ProgressStrip from '@/app/ProgressStrip'
import ListChipRow from '@/app/ListChipRow'
import BPCategoryHeader from '@/app/BPCategoryHeader'
import ItemCard, {ItemCardSkeleton} from '@/app/ItemCard'
import EmptyState from '@/app/EmptyState'
import BPSheet, {type BPSheetState} from '@/app/BPSheet'

import {checkItemMutation, getItemsQuery, getItemUpdatesSubscription, uncheckItemMutation} from '@/lib/item/Queries'
import {getCategoriesQuery, getCategoryUpdatesSubscription} from '@/lib/category/Queries'
import {listsQuery} from '@/lib/list/Queries'
import type {
  GetCategoriesQuery,
  GetCategoryUpdatesSubscription,
  GetCategoryUpdatesSubscriptionVariables,
  GetItemsQuery,
  GetItemUpdatesSubscription,
  GetItemUpdatesSubscriptionVariables,
} from '@/__generated__/graphql'

type Item = GetItemsQuery['getItems'][0]
type Category = GetCategoriesQuery['getCategories'][0]

function toLifecycle(recurring: string | null): 'once' | 'weekly' | 'biweekly' | 'monthly' | null {
  switch (recurring) {
    case 'ONE_TIME':
      return 'once'
    case 'WEEKLY':
      return 'weekly'
    case 'BIWEEKLY':
      return 'biweekly'
    case 'MONTHLY':
      return 'monthly'
    default:
      return null
  }
}

interface SnackbarState {
  key: string
  itemId: string
  itemName: string
}

function TodayPageInner() {
  const {listId} = useParams<{listId: string}>()
  const router = useRouter()
  const {announceToSR} = useSR()

  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null)
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set())
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set())
  const [sheetState, setSheetState] = useState<BPSheetState>('closed')
  const fabRef = useRef<HTMLButtonElement | null>(null)

  const {data: itemsData, loading: itemsLoading, subscribeToMore: itemsSubscribeToMore} =
    useQuery(getItemsQuery, {variables: {listId}, skip: !listId})

  const {data: categoriesData, subscribeToMore: categoriesSubscribeToMore} =
    useQuery(getCategoriesQuery, {variables: {listId}, skip: !listId})

  const {data: listsData} = useQuery(listsQuery)

  const [checkItem] = useMutation(checkItemMutation)
  const [uncheckItem] = useMutation(uncheckItemMutation)

  useEffect(() => {
    if (!listId) return
    const unsub = itemsSubscribeToMore<GetItemUpdatesSubscription, GetItemUpdatesSubscriptionVariables>({
      document: getItemUpdatesSubscription,
      variables: {listId},
      updateQuery: (prev, {subscriptionData}) => {
        const update = (subscriptionData as { data: GetItemUpdatesSubscription }).data?.getItemUpdates
        if (!update) return prev as unknown as GetItemsQuery
        const items: Item[] = (prev.getItems as Item[] | undefined) ?? []
        if (update.type === 'SAVED') {
          const idx = items.findIndex((i: Item) => i.id === update.item.id)
          const merged: Item = {...(items[idx] ?? update.item as Item), ...(update.item as Item)}
          const next: Item[] = idx >= 0
            ? [...items.slice(0, idx), merged, ...items.slice(idx + 1)]
            : [...items, update.item as Item]
          return {getItems: next}
        }
        if (update.type === 'DELETED') {
          return {getItems: items.filter((i: Item) => i.id !== update.item.id)}
        }
        return prev as unknown as GetItemsQuery
      },
    })
    return () => unsub()
  }, [listId, itemsSubscribeToMore])

  useEffect(() => {
    if (!listId) return
    const unsub = categoriesSubscribeToMore<GetCategoryUpdatesSubscription, GetCategoryUpdatesSubscriptionVariables>({
      document: getCategoryUpdatesSubscription,
      variables: {listId},
      updateQuery: (prev, {subscriptionData}) => {
        const update = (subscriptionData as { data: GetCategoryUpdatesSubscription }).data?.getCategoryUpdates
        if (!update) return prev as unknown as GetCategoriesQuery
        const cats: Category[] = (prev.getCategories as Category[] | undefined) ?? []
        if (update.type === 'SAVED') {
          const idx = cats.findIndex((c: Category) => c.id === update.item.id)
          const next: Category[] = idx >= 0
            ? [...cats.slice(0, idx), update.item as Category, ...cats.slice(idx + 1)]
            : [...cats, update.item as Category]
          return {getCategories: next}
        }
        if (update.type === 'DELETED') {
          return {getCategories: cats.filter((c: Category) => c.id !== update.item.id)}
        }
        return prev as unknown as GetCategoriesQuery
      },
    })
    return () => unsub()
  }, [listId, categoriesSubscribeToMore])

  const allItems: Item[] = itemsData?.getItems ?? []
  const visibleItems = allItems.filter((i: Item) => !i.deleted)

  const categoryMap = new Map<string, string>(
    (categoriesData?.getCategories ?? []).map((c: Category) => [c.id, c.name])
  )

  const totalCount = visibleItems.length
  const checkedCount = visibleItems.filter((i: Item) => i.checked).length
  const isComplete = totalCount > 0 && checkedCount >= totalCount

  const subtitle = isComplete
    ? `All done · ${totalCount} items`
    : `${totalCount} items`

  const activeList = listsData?.lists.lists.find(l => l.id === listId)
  const listName = activeList?.name ?? ''

  const allLists = listsData?.lists.lists ?? []
  const chipLists = allLists.map(l => ({
    id: l.id,
    name: l.name,
    emoji: l.emoji,
    itemCount: l.id === listId
      ? visibleItems.filter((i: Item) => !i.checked).length
      : 0,
  }))

  // Group visible items by category
  const categoryOrder: string[] = []
  const groups = new Map<string, Item[]>()
  for (const item of visibleItems) {
    if (!groups.has(item.category)) {
      groups.set(item.category, [])
      categoryOrder.push(item.category)
    }
    groups.get(item.category)!.push(item)
  }

  const handleCheck = (item: Item) => {
    if (checkingIds.has(item.id)) return
    setCheckingIds(prev => new Set(prev).add(item.id))
    announceToSR(`${item.name} removed`)
    setRemovingIds(prev => new Set(prev).add(item.id))
    setSnackbar({key: item.id, itemId: item.id, itemName: item.name})
    setFailedIds(prev => {
      const next = new Set(prev);
      next.delete(item.id);
      return next
    })

    checkItem({
      variables: {id: item.id, listId},
      optimisticResponse: {
        checkItem: {__typename: 'Item' as const, id: item.id, checked: true, checkedAt: new Date().toISOString()},
      },
      onError: () => {
        setFailedIds(prev => new Set(prev).add(item.id))
        setRemovingIds(prev => {
          const next = new Set(prev);
          next.delete(item.id);
          return next
        })
        setCheckingIds(prev => {
          const next = new Set(prev);
          next.delete(item.id);
          return next
        })
      },
    }).finally(() => {
      setCheckingIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next
      })
    })
  }

  const handleUndo = () => {
    if (!snackbar) return
    const {itemId} = snackbar
    setSnackbar(null)
    setRemovingIds(prev => {
      const next = new Set(prev);
      next.delete(itemId);
      return next
    })
    uncheckItem({variables: {id: itemId, listId}})
  }

  const handleSnackbarClose = (_: unknown, reason?: string) => {
    if (reason === 'clickaway') return
    setSnackbar(null)
  }

  const handleItemRemoved = (itemId: string) => {
    setRemovingIds(prev => {
      const next = new Set(prev);
      next.delete(itemId);
      return next
    })
  }

  return (
    <Box sx={{display: 'flex', flexDirection: 'column', minHeight: '100%'}}>
      {/* Sticky toolbar */}
      <Box sx={(t) => ({position: 'sticky', top: 0, zIndex: 10, bgcolor: t.palette.background.default, px: 2, py: 1})}>
        <Typography variant="h6" sx={(t) => ({
          fontSize: '20px',
          fontWeight: 600,
          lineHeight: 1.3,
          fontFamily: t.typography.fontFamily
        })}>
          {listName}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      </Box>

      {/* ProgressStrip sticky below toolbar */}
      <Box sx={(t) => ({position: 'sticky', top: 56, zIndex: 9, bgcolor: t.palette.background.default, px: 2, pb: 1})}>
        <ProgressStrip checked={checkedCount} total={totalCount}/>
      </Box>

      {/* Scrollable content */}
      <Box sx={{flex: 1}}>
        <ListChipRow
          lists={chipLists}
          activeListId={listId}
          onListSelect={(id) => router.push(`/list/${id}`, {scroll: false})}
        />

        {itemsLoading && (
          <>
            <ItemCardSkeleton/>
            <ItemCardSkeleton/>
            <ItemCardSkeleton/>
          </>
        )}

        {!itemsLoading && totalCount === 0 && allLists.length === 0 && (
          <EmptyState
            icon={<ListIcon sx={{width: 48, height: 48}}/>}
            title="Choose a list to start"
            subtitle="Tap a list below"
          />
        )}

        {!itemsLoading && totalCount === 0 && allLists.length > 0 && (
          <EmptyState
            icon={<InboxIcon sx={{width: 48, height: 48}}/>}
            title="Nothing here yet"
            subtitle="Add your first item"
            action={{label: 'Add item', onClick: () => setSheetState('peeked')}}
          />
        )}

        {!itemsLoading && categoryOrder.map(catId => {
          const catItems = groups.get(catId) ?? []
          const catChecked = catItems.filter((i: Item) => i.checked).length
          const allChecked = catItems.length > 0 && catChecked === catItems.length
          const catName = categoryMap.get(catId) ?? 'Uncategorized'

          return (
            <Box key={catId}>
              <BPCategoryHeader
                name={catName}
                checkedCount={catChecked}
                totalCount={catItems.length}
                collapsed={allChecked}
              />
              {catItems
                .filter(item => !allChecked || removingIds.has(item.id))
                .map((item: Item) => (
                  <ItemCard
                    key={item.id}
                    id={item.id}
                    name={item.name}
                    category={catName}
                    store={item.store}
                    checked={item.checked}
                    lifecycle={toLifecycle(item.recurring)}
                    removing={removingIds.has(item.id)}
                    onCheck={() => handleCheck(item)}
                    onRemoved={() => handleItemRemoved(item.id)}
                    checkDisabled={checkingIds.has(item.id)}
                    hasError={failedIds.has(item.id)}
                  />
                ))}
            </Box>
          )
        })}
      </Box>

      {/* FAB */}
      <Fab
        ref={fabRef}
        color="primary"
        aria-label="Add item"
        onClick={() => setSheetState('peeked')}
        sx={{position: 'fixed', bottom: 80, right: 16, zIndex: 10}}
      >
        <AddIcon/>
      </Fab>

      {/* Add item stub sheet */}
      <BPSheet
        state={sheetState}
        onStateChange={setSheetState}
        title="Add item"
        triggerRef={fabRef}
      >
        <Typography color="text.secondary" sx={{pt: 2}}>
          Add item — coming in Story 4.9
        </Typography>
      </BPSheet>

      {/* Check-off snackbar */}
      <Snackbar
        key={snackbar?.key ?? ''}
        open={snackbar !== null}
        autoHideDuration={5000}
        onClose={handleSnackbarClose}
        anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}
        message={snackbar ? `Removed · ${snackbar.itemName}` : ''}
        action={
          <Button color="primary" size="small" onClick={handleUndo}>
            Undo
          </Button>
        }
        sx={{bottom: 80}}
      />
    </Box>
  )
}

export default function TodayPage() {
  return (
    <SRProvider>
      <TodayPageInner/>
    </SRProvider>
  )
}
