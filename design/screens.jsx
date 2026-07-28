// Screens for Bag Please

// ────────────────────────────────────────────────────────────────────
// TODAY — main shopping list view
// ────────────────────────────────────────────────────────────────────
function ScreenToday({state, dispatch, t}) {
    const [filter, setFilter] = React.useState('all'); // all|todo|done
    const [search, setSearch] = React.useState('');
    const [collapsed, setCollapsed] = React.useState({});
    const list = state.lists.find(l => l.id === state.activeList) || state.lists[0];
    const memberById = Object.fromEntries(state.members.map(m => [m.id, m]));

    const allItems = state.items.filter(i => i.list === list.id);
    const filtered = allItems.filter(i => {
        if (filter === 'todo' && i.checked) return false;
        if (filter === 'done' && !i.checked) return false;
        if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const remaining = allItems.filter(i => !i.checked).length;
    const done = allItems.filter(i => i.checked).length;
    const progress = allItems.length === 0 ? 0 : done / allItems.length;

    // group by category, preserve category order
    const grouped = state.categories.map(c => ({
        cat: c,
        items: filtered.filter(i => i.category === c.id).sort((a, b) => a.name.localeCompare(b.name))
    })).filter(g => g.items.length > 0);

    const toggleCollapse = (id) => setCollapsed(c => ({...c, [id]: !c[id]}));

    return (
        <div style={{
            paddingBottom: 96, minHeight: '100%',
            background: 'var(--bp-bg)',
        }}>
            <BPToolbar
                title={list.name}
                subtitle={`${remaining} to buy · ${done} done`}
                trailing={
                    <React.Fragment>
                        <BPToolbarBtn ariaLabel="Share" onClick={() => dispatch({type: 'open_sheet', sheet: 'share'})}>
                            <span style={{fontSize: 16, display: 'flex'}}>{BPIcons.share}</span>
                        </BPToolbarBtn>
                        <BPToolbarBtn ariaLabel="Add" primary
                                      onClick={() => dispatch({type: 'open_sheet', sheet: 'add'})}>
                            <span style={{fontSize: 20, display: 'flex'}}>{BPIcons.plus}</span>
                        </BPToolbarBtn>
                    </React.Fragment>
                }
            />

            {/* Progress strip */}
            <div style={{padding: '0 20px 12px'}}>
                <div style={{
                    height: 6, borderRadius: 99, background: 'var(--bp-bg2)', overflow: 'hidden',
                    position: 'relative',
                }}>
                    <div style={{
                        position: 'absolute', inset: 0, width: `${progress * 100}%`,
                        background: 'var(--bp-accent)', borderRadius: 99,
                        transition: 'width 320ms cubic-bezier(.2,.7,.2,1)',
                    }}/>
                </div>
            </div>

            {/* List switcher chips */}
            <div style={{
                display: 'flex', gap: 8, padding: '4px 16px 12px',
                overflowX: 'auto', scrollbarWidth: 'none',
            }}>
                {state.lists.map(l => {
                    const active = l.id === list.id;
                    const itemCount = state.items.filter(i => i.list === l.id && !i.checked).length;
                    return (
                        <button key={l.id} onClick={() => dispatch({type: 'set_active_list', listId: l.id})}
                                style={{
                                    appearance: 'none', border: 0, cursor: 'pointer',
                                    padding: '6px 12px', borderRadius: 99,
                                    background: active ? 'var(--bp-accent)' : 'var(--bp-card)',
                                    color: active ? '#fff' : 'var(--bp-text)',
                                    boxShadow: active ? 'none' : 'var(--bp-shadow)',
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    fontSize: 13, fontWeight: 500, letterSpacing: -0.1,
                                    whiteSpace: 'nowrap', flexShrink: 0,
                                }}>
                            <span style={{fontSize: 14}}>{l.emoji}</span>
                            <span>{l.name}</span>
                            <span style={{
                                fontSize: 11, fontWeight: 600,
                                color: active ? 'rgba(255,255,255,0.85)' : 'var(--bp-ter)',
                                marginLeft: 2, fontFeatureSettings: '"tnum"',
                            }}>{itemCount}</span>
                        </button>
                    );
                })}
            </div>

            {/* Search + filter */}
            <BPSearch value={search} onChange={setSearch}/>
            <div style={{padding: '0 16px 14px'}}>
                <BPSegmented value={filter} onChange={setFilter} options={[
                    {value: 'all', label: `All ${allItems.length}`},
                    {value: 'todo', label: `To buy ${remaining}`},
                    {value: 'done', label: `Done ${done}`},
                ]}/>
            </div>

            {/* Categories */}
            {grouped.length === 0 ? (
                <div style={{
                    margin: '40px 32px', padding: '32px 24px',
                    background: 'var(--bp-card)', borderRadius: 14,
                    textAlign: 'center', color: 'var(--bp-sec)',
                    boxShadow: 'var(--bp-shadow)',
                }}>
                    <div style={{fontSize: 32, marginBottom: 8}}>🛍️</div>
                    <div style={{fontSize: 15, color: 'var(--bp-text)', fontWeight: 600, marginBottom: 4}}>
                        {search ? 'Nothing matches that' : filter === 'done' ? 'Nothing checked yet' : filter === 'todo' ? 'All done!' : 'List is empty'}
                    </div>
                    <div style={{fontSize: 13}}>
                        {search ? 'Try a different word' : 'Tap + to add an item'}
                    </div>
                </div>
            ) : (
                <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--bp-header-gap)'}}>
                    {grouped.map(g => {
                        const isCollapsed = !!collapsed[g.cat.id];
                        return (
                            <div key={g.cat.id}>
                                <div style={{padding: '0 24px'}}>
                                    <BPCategoryHeader
                                        num={g.cat.num} name={g.cat.name} count={g.items.length}
                                        collapsed={isCollapsed}
                                        onToggle={() => toggleCollapse(g.cat.id)}
                                    />
                                </div>
                                {!isCollapsed && (
                                    <div style={{
                                        margin: '0 16px',
                                        background: 'var(--bp-card)', borderRadius: 14,
                                        overflow: 'hidden',
                                        boxShadow: 'var(--bp-shadow)',
                                    }}>
                                        {g.items.map((it, idx) => (
                                            <div key={it.id} style={{
                                                borderBottom: idx < g.items.length - 1 ? '0.5px solid var(--bp-sep)' : 'none',
                                            }}>
                                                <BPItemRow
                                                    item={it}
                                                    member={memberById[it.addedBy]}
                                                    onToggle={() => dispatch({type: 'toggle', id: it.id})}
                                                    onEdit={() => dispatch({type: 'edit_item', id: it.id})}
                                                    showStore={t.showStore !== false}
                                                    showRecurring={t.showRecurring !== false}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────
// LISTS — manage multiple lists
// ────────────────────────────────────────────────────────────────────
function ScreenLists({state, dispatch}) {
    return (
        <div style={{paddingBottom: 96, background: 'var(--bp-bg)', minHeight: '100%'}}>
            <BPToolbar
                title="Lists"
                subtitle="Your shopping lists and side trips"
                trailing={
                    <BPToolbarBtn ariaLabel="Add list" primary
                                  onClick={() => dispatch({type: 'open_sheet', sheet: 'new_list'})}>
                        <span style={{fontSize: 20, display: 'flex'}}>{BPIcons.plus}</span>
                    </BPToolbarBtn>
                }
            />

            <div style={{
                padding: '4px 24px 8px',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 0.6,
                color: 'var(--bp-ter)',
                textTransform: 'uppercase'
            }}>
                Primary
            </div>
            <BPCard>
                {state.lists.filter(l => l.primary).map(l => (
                    <ListRow key={l.id} list={l} state={state} dispatch={dispatch} last/>
                ))}
            </BPCard>

            <div style={{
                padding: '20px 24px 8px',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 0.6,
                color: 'var(--bp-ter)',
                textTransform: 'uppercase'
            }}>
                Side trips
            </div>
            <BPCard>
                {state.lists.filter(l => !l.primary).map((l, i, arr) => (
                    <ListRow key={l.id} list={l} state={state} dispatch={dispatch} last={i === arr.length - 1}/>
                ))}
            </BPCard>

            <div style={{
                padding: '24px 24px 8px',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 0.6,
                color: 'var(--bp-ter)',
                textTransform: 'uppercase'
            }}>
                Catalog
            </div>
            <BPCard>
                <BPCardRow
                    leading={<span style={{
                        fontSize: 22,
                        width: 28,
                        display: 'flex',
                        justifyContent: 'center',
                        color: 'var(--bp-accent)'
                    }}>{BPIcons.tag}</span>}
                    trailing={<span
                        style={{color: 'var(--bp-ter)', fontSize: 14, display: 'flex'}}>{BPIcons.chev}</span>}
                    onClick={() => dispatch({type: 'go', screen: 'categories'})}
                >
                    <div style={{fontSize: 16, color: 'var(--bp-text)'}}>Categories</div>
                    <div style={{fontSize: 12, color: 'var(--bp-sec)'}}>{state.categories.length} groups</div>
                </BPCardRow>
                <BPCardRow last
                           leading={<span style={{
                               fontSize: 22,
                               width: 28,
                               display: 'flex',
                               justifyContent: 'center',
                               color: 'var(--bp-accent)'
                           }}>{BPIcons.cart}</span>}
                           trailing={<span
                               style={{color: 'var(--bp-ter)', fontSize: 14, display: 'flex'}}>{BPIcons.chev}</span>}
                           onClick={() => dispatch({type: 'go', screen: 'catalog'})}
                >
                    <div style={{fontSize: 16, color: 'var(--bp-text)'}}>All items</div>
                    <div style={{fontSize: 12, color: 'var(--bp-sec)'}}>{state.items.length} items across lists</div>
                </BPCardRow>
            </BPCard>
        </div>
    );
}

function ListRow({list, state, dispatch, last}) {
    const itemCount = state.items.filter(i => i.list === list.id).length;
    const remaining = state.items.filter(i => i.list === list.id && !i.checked).length;
    const members = list.members.map(mid => state.members.find(m => m.id === mid)).filter(Boolean);
    const active = state.activeList === list.id;
    return (
        <BPCardRow last={last}
                   onClick={() => {
                       dispatch({type: 'set_active_list', listId: list.id});
                       dispatch({type: 'go', screen: 'today'});
                   }}
                   leading={
                       <div style={{
                           width: 38, height: 38, borderRadius: 10,
                           background: active ? 'var(--bp-accent-soft)' : 'var(--bp-bg2)',
                           display: 'flex', alignItems: 'center', justifyContent: 'center',
                           fontSize: 20,
                       }}>{list.emoji}</div>
                   }
                   trailing={
                       <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                           <div style={{display: 'flex', marginRight: -4}}>
                               {members.slice(0, 3).map((m, i) => (
                                   <div key={m.id} style={{marginLeft: i > 0 ? -6 : 0}}>
                                       <BPAvatar member={m} size={20} ring/>
                                   </div>
                               ))}
                           </div>
                           <span style={{color: 'var(--bp-ter)', fontSize: 14, display: 'flex'}}>{BPIcons.chev}</span>
                       </div>
                   }
        >
            <div style={{display: 'flex', alignItems: 'baseline', gap: 8}}>
                <span style={{fontSize: 16, color: 'var(--bp-text)', fontWeight: 500}}>{list.name}</span>
                {active && (
                    <span style={{
                        fontSize: 10, fontWeight: 600, letterSpacing: 0.5,
                        color: 'var(--bp-accent)', padding: '2px 6px',
                        background: 'var(--bp-accent-soft)', borderRadius: 4,
                        textTransform: 'uppercase',
                    }}>Active</span>
                )}
            </div>
            <div style={{fontSize: 12, color: 'var(--bp-sec)'}}>
                {remaining > 0 ? `${remaining} to buy` : itemCount > 0 ? 'All done' : 'Empty'} · {itemCount} total
            </div>
        </BPCardRow>
    );
}

// ────────────────────────────────────────────────────────────────────
// HOUSEHOLD — sharing
// ────────────────────────────────────────────────────────────────────
function ScreenHousehold({state, dispatch}) {
    return (
        <div style={{paddingBottom: 96, background: 'var(--bp-bg)', minHeight: '100%'}}>
            <BPToolbar
                title="Household"
                subtitle="Shared with 3 people"
                trailing={
                    <BPToolbarBtn ariaLabel="Invite" primary
                                  onClick={() => dispatch({type: 'open_sheet', sheet: 'invite'})}>
                        <span style={{fontSize: 20, display: 'flex'}}>{BPIcons.plus}</span>
                    </BPToolbarBtn>
                }
            />

            <div style={{
                padding: '4px 24px 8px',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 0.6,
                color: 'var(--bp-ter)',
                textTransform: 'uppercase'
            }}>
                Members
            </div>
            <BPCard>
                {state.members.map((m, i) => (
                    <BPCardRow key={m.id} last={i === state.members.length - 1}
                               leading={<BPAvatar member={m} size={34}/>}
                               trailing={
                                   <span style={{
                                       fontSize: 12, color: 'var(--bp-sec)', fontWeight: 500,
                                   }}>{m.id === 'you' ? 'Admin' : 'Member'}</span>
                               }
                    >
                        <div style={{fontSize: 16, color: 'var(--bp-text)'}}>
                            {m.name} {m.id === 'you' &&
                            <span style={{color: 'var(--bp-sec)', fontWeight: 400}}>(you)</span>}
                        </div>
                        <div style={{fontSize: 12, color: 'var(--bp-sec)'}}>
                            {m.id === 'mira' && 'mira@home.app · joined Apr 2026'}
                            {m.id === 'leo' && 'leo@home.app · joined May 2026'}
                            {m.id === 'you' && 'demo@home.app'}
                        </div>
                    </BPCardRow>
                ))}
            </BPCard>

            <div style={{
                padding: '20px 24px 8px',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 0.6,
                color: 'var(--bp-ter)',
                textTransform: 'uppercase'
            }}>
                Recent activity
            </div>
            <BPCard>
                {[
                    {who: 'mira', what: 'added', name: 'Avocado', when: '2m ago'},
                    {who: 'leo', what: 'checked off', name: 'Painter\u2019s tape', when: '14m ago'},
                    {who: 'mira', what: 'added', name: 'Greek yogurt', when: '1h ago'},
                    {who: 'you', what: 'created', name: 'IKEA run list', when: 'Yesterday'},
                ].map((a, i, arr) => {
                    const m = state.members.find(x => x.id === a.who);
                    return (
                        <BPCardRow key={i} last={i === arr.length - 1}
                                   leading={<BPAvatar member={m} size={28}/>}
                                   trailing={<span style={{fontSize: 12, color: 'var(--bp-ter)'}}>{a.when}</span>}
                        >
                            <div style={{fontSize: 14, color: 'var(--bp-text)'}}>
                                <span style={{fontWeight: 600}}>{m.name}</span>
                                <span style={{color: 'var(--bp-sec)'}}> {a.what} </span>
                                <span>{a.name}</span>
                            </div>
                        </BPCardRow>
                    );
                })}
            </BPCard>

            <div style={{
                padding: '20px 24px 8px',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 0.6,
                color: 'var(--bp-ter)',
                textTransform: 'uppercase'
            }}>
                Account
            </div>
            <BPCard>
                <BPCardRow
                    trailing={<span
                        style={{color: 'var(--bp-ter)', fontSize: 14, display: 'flex'}}>{BPIcons.chev}</span>}
                    leading={<span
                        style={{fontSize: 20, color: 'var(--bp-accent)', display: 'flex'}}>{BPIcons.bell}</span>}
                >
                    <div style={{fontSize: 16}}>Notifications</div>
                    <div style={{fontSize: 12, color: 'var(--bp-sec)'}}>When household adds items</div>
                </BPCardRow>
                <BPCardRow last
                           trailing={<span
                               style={{color: 'var(--bp-ter)', fontSize: 14, display: 'flex'}}>{BPIcons.chev}</span>}
                           leading={<span style={{
                               fontSize: 20,
                               color: 'var(--bp-accent)',
                               display: 'flex'
                           }}>{BPIcons.person}</span>}
                >
                    <div style={{fontSize: 16}}>Sign out</div>
                </BPCardRow>
            </BPCard>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────
// CATEGORIES — manage groups
// ────────────────────────────────────────────────────────────────────
function ScreenCategories({state, dispatch}) {
    return (
        <div style={{paddingBottom: 96, background: 'var(--bp-bg)', minHeight: '100%'}}>
            <BPToolbar
                title="Categories"
                subtitle="Organize how items appear in lists"
                onBack={() => dispatch({type: 'go', screen: 'lists'})}
                trailing={
                    <BPToolbarBtn ariaLabel="Add" primary onClick={() => alert('Stub: add category')}>
                        <span style={{fontSize: 20, display: 'flex'}}>{BPIcons.plus}</span>
                    </BPToolbarBtn>
                }
            />
            <BPCard>
                {state.categories.map((c, i, arr) => {
                    const count = state.items.filter(x => x.category === c.id).length;
                    return (
                        <BPCardRow key={c.id} last={i === arr.length - 1}
                                   leading={
                                       <div style={{
                                           width: 30, fontSize: 12, fontWeight: 600,
                                           color: 'var(--bp-ter)', textAlign: 'center',
                                           fontFeatureSettings: '"tnum"',
                                       }}>{c.num}</div>
                                   }
                                   trailing={
                                       <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                                           <span style={{fontSize: 13, color: 'var(--bp-sec)'}}>{count}</span>
                                           <span
                                               style={{color: 'var(--bp-ter)', fontSize: 14, display: 'flex'}}>⋮⋮</span>
                                       </div>
                                   }
                        >
                            <div style={{fontSize: 16, color: 'var(--bp-text)'}}>{c.name}</div>
                        </BPCardRow>
                    );
                })}
            </BPCard>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────
// CATALOG — full item management
// ────────────────────────────────────────────────────────────────────
function ScreenCatalog({state, dispatch}) {
    const [search, setSearch] = React.useState('');
    const items = state.items
        .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name));
    const catById = Object.fromEntries(state.categories.map(c => [c.id, c]));
    const listById = Object.fromEntries(state.lists.map(l => [l.id, l]));

    return (
        <div style={{paddingBottom: 96, background: 'var(--bp-bg)', minHeight: '100%'}}>
            <BPToolbar
                title="All items"
                subtitle={`${state.items.length} items in catalog`}
                onBack={() => dispatch({type: 'go', screen: 'lists'})}
                trailing={
                    <BPToolbarBtn ariaLabel="Add" primary onClick={() => dispatch({type: 'open_sheet', sheet: 'add'})}>
                        <span style={{fontSize: 20, display: 'flex'}}>{BPIcons.plus}</span>
                    </BPToolbarBtn>
                }
            />
            <BPSearch value={search} onChange={setSearch}/>
            <BPCard>
                {items.map((it, i) => (
                    <BPCardRow key={it.id} last={i === items.length - 1}
                               onClick={() => dispatch({type: 'edit_item', id: it.id})}
                               leading={
                                   <div style={{
                                       width: 32, height: 32, borderRadius: 8,
                                       background: 'var(--bp-bg2)',
                                       display: 'flex', alignItems: 'center', justifyContent: 'center',
                                       fontSize: 14,
                                   }}>{listById[it.list]?.emoji || '·'}</div>
                               }
                               trailing={<span style={{
                                   color: 'var(--bp-ter)',
                                   fontSize: 14,
                                   display: 'flex'
                               }}>{BPIcons.chev}</span>}
                    >
                        <div style={{fontSize: 15, color: 'var(--bp-text)'}}>{it.name}</div>
                        <div style={{fontSize: 12, color: 'var(--bp-sec)'}}>
                            {catById[it.category]?.name || '—'}
                            {it.store && <span> · {it.store}</span>}
                            {it.recurring && <span> · {it.recurring}</span>}
                        </div>
                    </BPCardRow>
                ))}
            </BPCard>
        </div>
    );
}

Object.assign(window, {
    ScreenToday, ScreenLists, ScreenHousehold, ScreenCategories, ScreenCatalog,
});
