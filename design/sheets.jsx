// Bottom sheets: item editor, add item, invite, new list

// ────────────────────────────────────────────────────────────────────
// Item editor sheet
// ────────────────────────────────────────────────────────────────────
function SheetItemEditor({state, dispatch, t}) {
    const open = state.sheet?.kind === 'edit' || state.sheet?.kind === 'add';
    const isNew = state.sheet?.kind === 'add';
    const id = state.sheet?.id;
    const existing = id ? state.items.find(i => i.id === id) : null;

    const [draft, setDraft] = React.useState({
        name: '', category: state.categories[0]?.id || '',
        list: state.activeList, store: '', recurring: null,
    });

    React.useEffect(() => {
        if (open) {
            if (existing) {
                setDraft({
                    name: existing.name, category: existing.category, list: existing.list,
                    store: existing.store || '', recurring: existing.recurring || null,
                });
            } else {
                setDraft({
                    name: '', category: state.categories[0]?.id || '',
                    list: state.activeList, store: '', recurring: null,
                });
            }
        }
    }, [open, id]);

    const close = () => dispatch({type: 'close_sheet'});
    const save = () => {
        if (!draft.name.trim()) return;
        if (isNew) {
            dispatch({
                type: 'add_item', item: {
                    id: 'n' + Date.now(),
                    name: draft.name.trim(),
                    category: draft.category,
                    list: draft.list,
                    store: draft.store.trim() || null,
                    recurring: draft.recurring,
                    checked: false,
                    addedBy: 'you',
                }
            });
        } else {
            dispatch({
                type: 'update_item', id, patch: {
                    name: draft.name.trim(),
                    category: draft.category,
                    list: draft.list,
                    store: draft.store.trim() || null,
                    recurring: draft.recurring,
                }
            });
        }
        close();
    };
    const del = () => {
        if (existing) dispatch({type: 'delete_item', id});
        close();
    };

    return (
        <BPSheet open={open} onClose={close} title={isNew ? 'New item' : 'Edit item'} maxHeight="92%">
            <div style={{padding: '4px 16px 8px'}}>
                {/* Name */}
                <FieldGroup>
                    <Field label="Name">
                        <BPInput value={draft.name} onChange={(v) => setDraft({...draft, name: v})}
                                 placeholder="e.g. Avocado" autoFocus={isNew}/>
                    </Field>
                </FieldGroup>

                {/* Category */}
                <SectionLabel>Category</SectionLabel>
                <FieldGroup>
                    {state.categories.map((c, i, arr) => (
                        <button key={c.id} onClick={() => setDraft({...draft, category: c.id})} style={{
                            appearance: 'none', border: 0, width: '100%', textAlign: 'left',
                            padding: '12px 16px', background: 'transparent',
                            borderBottom: i < arr.length - 1 ? '0.5px solid var(--bp-sep)' : 'none',
                            display: 'flex', alignItems: 'center', cursor: 'pointer',
                            color: 'var(--bp-text)', font: 'inherit',
                        }}>
                            <span style={{
                                fontSize: 12,
                                color: 'var(--bp-ter)',
                                width: 26,
                                fontFeatureSettings: '"tnum"'
                            }}>{c.num}</span>
                            <span style={{flex: 1, fontSize: 15}}>{c.name}</span>
                            {draft.category === c.id && (
                                <span style={{
                                    color: 'var(--bp-accent)',
                                    fontSize: 18,
                                    display: 'flex'
                                }}>{BPIcons.check}</span>
                            )}
                        </button>
                    ))}
                </FieldGroup>

                {/* List */}
                <SectionLabel>List</SectionLabel>
                <FieldGroup>
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, padding: 12}}>
                        {state.lists.map(l => {
                            const active = draft.list === l.id;
                            return (
                                <button key={l.id} onClick={() => setDraft({...draft, list: l.id})} style={{
                                    appearance: 'none',
                                    border: '1px solid ' + (active ? 'var(--bp-accent)' : 'var(--bp-sep)'),
                                    background: active ? 'var(--bp-accent-soft)' : 'transparent',
                                    color: active ? 'var(--bp-accent)' : 'var(--bp-text)',
                                    padding: '6px 12px',
                                    borderRadius: 99,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    fontSize: 13,
                                    cursor: 'pointer',
                                    font: 'inherit',
                                }}>
                                    <span style={{fontSize: 14}}>{l.emoji}</span>
                                    <span style={{fontWeight: 500}}>{l.name}</span>
                                </button>
                            );
                        })}
                    </div>
                </FieldGroup>

                {/* Store */}
                <SectionLabel>Where to buy</SectionLabel>
                <FieldGroup>
                    <div style={{padding: '4px 16px'}}>
                        <BPInput value={draft.store} onChange={(v) => setDraft({...draft, store: v})}
                                 placeholder="Any store · or pick one below"/>
                    </div>
                    <div style={{padding: '4px 12px 12px', display: 'flex', flexWrap: 'wrap', gap: 6}}>
                        {['Whole Foods', 'Trader Joe\u2019s', 'Target', 'CVS', 'Home Depot', 'IKEA', 'Local market'].map(s => (
                            <button key={s} onClick={() => setDraft({...draft, store: s})} style={{
                                appearance: 'none', border: 0,
                                background: draft.store === s ? 'var(--bp-accent-soft)' : 'var(--bp-bg2)',
                                color: draft.store === s ? 'var(--bp-accent)' : 'var(--bp-sec)',
                                padding: '5px 10px', borderRadius: 99,
                                fontSize: 12, cursor: 'pointer', font: 'inherit',
                                fontWeight: 500,
                            }}>{s}</button>
                        ))}
                    </div>
                </FieldGroup>

                {/* Recurring */}
                <SectionLabel>Replenish</SectionLabel>
                <FieldGroup>
                    <div style={{padding: 12}}>
                        <BPSegmented value={draft.recurring || 'never'}
                                     onChange={(v) => setDraft({...draft, recurring: v === 'never' ? null : v})}
                                     options={[
                                         {value: 'never', label: 'Never'},
                                         {value: 'weekly', label: 'Weekly'},
                                         {value: 'biweekly', label: 'Biweekly'},
                                         {value: 'monthly', label: 'Monthly'},
                                     ]}
                        />
                        <div style={{fontSize: 12, color: 'var(--bp-sec)', marginTop: 8, lineHeight: 1.4}}>
                            When checked off, this item reappears on the list after the chosen interval.
                        </div>
                    </div>
                </FieldGroup>

                {/* Actions */}
                <div style={{display: 'flex', gap: 10, padding: '20px 16px 16px'}}>
                    {!isNew && (
                        <button onClick={del} style={{
                            appearance: 'none', border: 0, cursor: 'pointer',
                            padding: '12px 16px', borderRadius: 12,
                            background: 'transparent', color: 'var(--bp-destructive)',
                            fontSize: 15, fontWeight: 600, font: 'inherit',
                            display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                            <span style={{display: 'flex'}}>{BPIcons.trash}</span> Delete
                        </button>
                    )}
                    <div style={{flex: 1}}/>
                    <button onClick={close} style={{
                        appearance: 'none', border: 0, cursor: 'pointer',
                        padding: '12px 18px', borderRadius: 12,
                        background: 'var(--bp-bg2)', color: 'var(--bp-text)',
                        fontSize: 15, fontWeight: 500, font: 'inherit',
                    }}>Cancel
                    </button>
                    <button onClick={save} disabled={!draft.name.trim()} style={{
                        appearance: 'none', border: 0, cursor: 'pointer',
                        padding: '12px 20px', borderRadius: 12,
                        background: 'var(--bp-accent)',
                        color: '#fff', fontSize: 15, fontWeight: 600, font: 'inherit',
                        opacity: draft.name.trim() ? 1 : 0.4,
                    }}>{isNew ? 'Add' : 'Save'}</button>
                </div>
            </div>
        </BPSheet>
    );
}

function FieldGroup({children}) {
    return (
        <div style={{
            background: 'var(--bp-card)', borderRadius: 14,
            overflow: 'hidden', boxShadow: 'var(--bp-shadow)',
            marginBottom: 12,
        }}>{children}</div>
    );
}

function Field({label, children}) {
    return (
        <div style={{padding: '4px 16px 6px'}}>
            <div style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 0.5,
                color: 'var(--bp-ter)',
                textTransform: 'uppercase',
                marginTop: 8
            }}>{label}</div>
            {children}
        </div>
    );
}

function SectionLabel({children}) {
    return (
        <div style={{
            padding: '14px 12px 6px', fontSize: 11, fontWeight: 600,
            letterSpacing: 0.6, color: 'var(--bp-ter)', textTransform: 'uppercase',
        }}>{children}</div>
    );
}

// ────────────────────────────────────────────────────────────────────
// Invite sheet
// ────────────────────────────────────────────────────────────────────
function SheetInvite({state, dispatch}) {
    const open = state.sheet?.kind === 'invite';
    const [val, setVal] = React.useState('');
    const [sent, setSent] = React.useState(false);
    React.useEffect(() => {
        if (open) {
            setVal('');
            setSent(false);
        }
    }, [open]);

    return (
        <BPSheet open={open} onClose={() => dispatch({type: 'close_sheet'})} title="Invite to household">
            <div style={{padding: '4px 16px 16px'}}>
                <div style={{fontSize: 14, color: 'var(--bp-sec)', padding: '4px 4px 14px', lineHeight: 1.45}}>
                    They'll see your lists, can check items off, and add their own.
                </div>
                <FieldGroup>
                    <div style={{padding: '4px 16px'}}>
                        <div style={{
                            fontSize: 11,
                            fontWeight: 600,
                            letterSpacing: 0.5,
                            color: 'var(--bp-ter)',
                            textTransform: 'uppercase',
                            marginTop: 10
                        }}>Email or username
                        </div>
                        <BPInput value={val} onChange={setVal} placeholder="name@home.app" autoFocus/>
                    </div>
                </FieldGroup>

                <SectionLabel>Permissions</SectionLabel>
                <FieldGroup>
                    <BPCardRow trailing={<span
                        style={{color: 'var(--bp-accent)', fontSize: 18, display: 'flex'}}>{BPIcons.check}</span>}>
                        <div style={{fontSize: 15}}>Add &amp; check items</div>
                        <div style={{fontSize: 12, color: 'var(--bp-sec)'}}>Standard member</div>
                    </BPCardRow>
                    <BPCardRow last>
                        <div style={{fontSize: 15}}>Admin (manage lists &amp; members)</div>
                    </BPCardRow>
                </FieldGroup>

                <div style={{display: 'flex', gap: 10, paddingTop: 8}}>
                    <button onClick={() => dispatch({type: 'close_sheet'})} style={{
                        appearance: 'none', border: 0, cursor: 'pointer', flex: 1,
                        padding: '14px 20px', borderRadius: 12,
                        background: 'var(--bp-bg2)', color: 'var(--bp-text)',
                        fontSize: 15, fontWeight: 500, font: 'inherit',
                    }}>Cancel
                    </button>
                    <button onClick={() => {
                        setSent(true);
                        setTimeout(() => dispatch({type: 'close_sheet'}), 800);
                    }}
                            disabled={!val.trim() || sent}
                            style={{
                                appearance: 'none', border: 0, cursor: 'pointer', flex: 2,
                                padding: '14px 20px', borderRadius: 12,
                                background: 'var(--bp-accent)', color: '#fff',
                                fontSize: 15, fontWeight: 600, font: 'inherit',
                                opacity: val.trim() ? 1 : 0.4,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            }}>
                        {sent ? <React.Fragment><span
                            style={{display: 'flex'}}>{BPIcons.check}</span> Sent</React.Fragment> : 'Send invite'}
                    </button>
                </div>
            </div>
        </BPSheet>
    );
}

// ────────────────────────────────────────────────────────────────────
// Share sheet (for current list)
// ────────────────────────────────────────────────────────────────────
function SheetShare({state, dispatch}) {
    const open = state.sheet?.kind === 'share';
    const list = state.lists.find(l => l.id === state.activeList);
    if (!list) return null;
    const members = list.members.map(mid => state.members.find(m => m.id === mid)).filter(Boolean);
    return (
        <BPSheet open={open} onClose={() => dispatch({type: 'close_sheet'})} title={`Share "${list.name}"`}>
            <div style={{padding: '4px 16px 16px'}}>
                <SectionLabel>Sharing with</SectionLabel>
                <FieldGroup>
                    {members.map((m, i) => (
                        <BPCardRow key={m.id} last={i === members.length - 1}
                                   leading={<BPAvatar member={m} size={32}/>}
                                   trailing={<span style={{
                                       fontSize: 12,
                                       color: 'var(--bp-sec)'
                                   }}>{m.id === 'you' ? 'You' : 'Member'}</span>}
                        >
                            <div style={{fontSize: 15}}>{m.name}</div>
                        </BPCardRow>
                    ))}
                </FieldGroup>
                <button onClick={() => dispatch({type: 'open_sheet', sheet: 'invite'})} style={{
                    appearance: 'none', border: 0, cursor: 'pointer', width: '100%',
                    padding: '14px 20px', borderRadius: 12,
                    background: 'var(--bp-accent)', color: '#fff',
                    fontSize: 15, fontWeight: 600, font: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    marginTop: 8,
                }}>
                    <span style={{display: 'flex'}}>{BPIcons.plus}</span> Invite someone
                </button>
            </div>
        </BPSheet>
    );
}

// ────────────────────────────────────────────────────────────────────
// New list sheet
// ────────────────────────────────────────────────────────────────────
function SheetNewList({state, dispatch}) {
    const open = state.sheet?.kind === 'new_list';
    const [name, setName] = React.useState('');
    const [emoji, setEmoji] = React.useState('🧺');
    React.useEffect(() => {
        if (open) {
            setName('');
            setEmoji('🧺');
        }
    }, [open]);
    const create = () => {
        if (!name.trim()) return;
        dispatch({
            type: 'add_list', list: {
                id: 'l' + Date.now(), name: name.trim(), emoji, primary: false, members: ['you'],
            }
        });
        dispatch({type: 'close_sheet'});
    };
    return (
        <BPSheet open={open} onClose={() => dispatch({type: 'close_sheet'})} title="New list">
            <div style={{padding: '4px 16px 16px'}}>
                <div style={{fontSize: 14, color: 'var(--bp-sec)', padding: '0 4px 12px', lineHeight: 1.45}}>
                    A side trip — like a one-off pharmacy or IKEA run.
                </div>
                <FieldGroup>
                    <div style={{padding: '6px 16px 12px'}}>
                        <div style={{
                            fontSize: 11,
                            fontWeight: 600,
                            letterSpacing: 0.5,
                            color: 'var(--bp-ter)',
                            textTransform: 'uppercase',
                            marginTop: 6
                        }}>Name
                        </div>
                        <BPInput value={name} onChange={setName} placeholder="e.g. Costco run" autoFocus/>
                    </div>
                </FieldGroup>
                <SectionLabel>Icon</SectionLabel>
                <FieldGroup>
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, padding: 12}}>
                        {['🛒', '💊', '🔩', '🪑', '🧺', '🌿', '🍞', '🎂', '🎁', '📚'].map(e => (
                            <button key={e} onClick={() => setEmoji(e)} style={{
                                appearance: 'none', border: 0, cursor: 'pointer',
                                width: 38, height: 38, borderRadius: 10,
                                background: emoji === e ? 'var(--bp-accent-soft)' : 'var(--bp-bg2)',
                                outline: emoji === e ? '2px solid var(--bp-accent)' : 'none',
                                fontSize: 20,
                            }}>{e}</button>
                        ))}
                    </div>
                </FieldGroup>
                <div style={{display: 'flex', gap: 10, paddingTop: 8}}>
                    <button onClick={() => dispatch({type: 'close_sheet'})} style={{
                        appearance: 'none', border: 0, cursor: 'pointer', flex: 1,
                        padding: '14px 20px', borderRadius: 12,
                        background: 'var(--bp-bg2)', color: 'var(--bp-text)',
                        fontSize: 15, fontWeight: 500, font: 'inherit',
                    }}>Cancel
                    </button>
                    <button onClick={create} disabled={!name.trim()} style={{
                        appearance: 'none', border: 0, cursor: 'pointer', flex: 2,
                        padding: '14px 20px', borderRadius: 12,
                        background: 'var(--bp-accent)', color: '#fff',
                        fontSize: 15, fontWeight: 600, font: 'inherit',
                        opacity: name.trim() ? 1 : 0.4,
                    }}>Create list
                    </button>
                </div>
            </div>
        </BPSheet>
    );
}

Object.assign(window, {SheetItemEditor, SheetInvite, SheetShare, SheetNewList, FieldGroup, Field, SectionLabel});
