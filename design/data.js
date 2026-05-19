// Seed data for Bag Please prototype
window.__BP_SEED = (() => {
    const categories = [
        {id: 'produce', name: 'Produce', num: '01'},
        {id: 'frozen', name: 'Frozen', num: '02'},
        {id: 'dairy', name: 'Dairy & Eggs', num: '03'},
        {id: 'meat', name: 'Meat & Fish', num: '04'},
        {id: 'pantry', name: 'Pantry', num: '05'},
        {id: 'bakery', name: 'Bakery', num: '06'},
        {id: 'household', name: 'Household', num: '07'},
        {id: 'pharmacy', name: 'Pharmacy', num: '08'},
    ];

    const lists = [
        {id: 'main', name: 'Groceries', emoji: '🛒', primary: true, members: ['you', 'mira', 'leo']},
        {id: 'pharma', name: 'Pharmacy', emoji: '💊', primary: false, members: ['you', 'mira']},
        {id: 'hardware', name: 'Hardware', emoji: '🔩', primary: false, members: ['you']},
        {id: 'ikea', name: 'IKEA run', emoji: '🪑', primary: false, members: ['you', 'leo']},
    ];

    // recurring: null | 'weekly' | 'biweekly' | 'monthly'
    const items = [
        // Groceries — produce
        {
            id: 'i01',
            list: 'main',
            name: 'Avocado',
            category: 'produce',
            checked: false,
            store: 'Whole Foods',
            recurring: 'weekly',
            addedBy: 'mira'
        },
        {
            id: 'i02',
            list: 'main',
            name: 'Bell pepper',
            category: 'produce',
            checked: false,
            store: null,
            recurring: null,
            addedBy: 'you'
        },
        {
            id: 'i03',
            list: 'main',
            name: 'Cucumber',
            category: 'produce',
            checked: true,
            store: null,
            recurring: 'weekly',
            addedBy: 'you'
        },
        {
            id: 'i04',
            list: 'main',
            name: 'Lemon',
            category: 'produce',
            checked: false,
            store: null,
            recurring: null,
            addedBy: 'leo'
        },
        {
            id: 'i05',
            list: 'main',
            name: 'Onion',
            category: 'produce',
            checked: false,
            store: null,
            recurring: 'biweekly',
            addedBy: 'you'
        },
        {
            id: 'i06',
            list: 'main',
            name: 'Spinach',
            category: 'produce',
            checked: false,
            store: 'Whole Foods',
            recurring: null,
            addedBy: 'mira'
        },
        // frozen
        {
            id: 'i10',
            list: 'main',
            name: 'Frozen berries',
            category: 'frozen',
            checked: false,
            store: 'Trader Joe\u2019s',
            recurring: 'biweekly',
            addedBy: 'you'
        },
        {
            id: 'i11',
            list: 'main',
            name: 'Frozen peas',
            category: 'frozen',
            checked: true,
            store: null,
            recurring: null,
            addedBy: 'mira'
        },
        // dairy
        {
            id: 'i20',
            list: 'main',
            name: 'Whole milk',
            category: 'dairy',
            checked: false,
            store: null,
            recurring: 'weekly',
            addedBy: 'you'
        },
        {
            id: 'i21',
            list: 'main',
            name: 'Greek yogurt',
            category: 'dairy',
            checked: false,
            store: null,
            recurring: 'weekly',
            addedBy: 'mira'
        },
        {
            id: 'i22',
            list: 'main',
            name: 'Butter',
            category: 'dairy',
            checked: true,
            store: null,
            recurring: null,
            addedBy: 'you'
        },
        {
            id: 'i23',
            list: 'main',
            name: 'Eggs (12)',
            category: 'dairy',
            checked: false,
            store: null,
            recurring: 'weekly',
            addedBy: 'you'
        },
        // meat
        {
            id: 'i30',
            list: 'main',
            name: 'Chicken thighs',
            category: 'meat',
            checked: false,
            store: 'Butcher\u2019s',
            recurring: null,
            addedBy: 'leo'
        },
        {
            id: 'i31',
            list: 'main',
            name: 'Salmon fillet',
            category: 'meat',
            checked: false,
            store: null,
            recurring: null,
            addedBy: 'mira'
        },
        // pantry
        {
            id: 'i40',
            list: 'main',
            name: 'Olive oil',
            category: 'pantry',
            checked: false,
            store: null,
            recurring: 'monthly',
            addedBy: 'you'
        },
        {
            id: 'i41',
            list: 'main',
            name: 'Basmati rice',
            category: 'pantry',
            checked: true,
            store: null,
            recurring: null,
            addedBy: 'you'
        },
        {
            id: 'i42',
            list: 'main',
            name: 'Sea salt, fine',
            category: 'pantry',
            checked: false,
            store: null,
            recurring: null,
            addedBy: 'mira'
        },
        {
            id: 'i43',
            list: 'main',
            name: 'Almond butter',
            category: 'pantry',
            checked: false,
            store: 'Whole Foods',
            recurring: null,
            addedBy: 'leo'
        },
        // bakery
        {
            id: 'i50',
            list: 'main',
            name: 'Sourdough loaf',
            category: 'bakery',
            checked: false,
            store: 'Bread Alone',
            recurring: 'weekly',
            addedBy: 'you'
        },
        {
            id: 'i51',
            list: 'main',
            name: 'Dark chocolate',
            category: 'bakery',
            checked: false,
            store: null,
            recurring: null,
            addedBy: 'mira'
        },
        // household
        {
            id: 'i60',
            list: 'main',
            name: 'Toilet paper',
            category: 'household',
            checked: false,
            store: 'Target',
            recurring: 'monthly',
            addedBy: 'you'
        },
        {
            id: 'i61',
            list: 'main',
            name: 'Dish soap',
            category: 'household',
            checked: false,
            store: null,
            recurring: 'monthly',
            addedBy: 'you'
        },
        {
            id: 'i62',
            list: 'main',
            name: 'Sponges',
            category: 'household',
            checked: true,
            store: null,
            recurring: null,
            addedBy: 'mira'
        },

        // Pharmacy list
        {
            id: 'p01',
            list: 'pharma',
            name: 'Eye drops',
            category: 'pharmacy',
            checked: false,
            store: 'CVS',
            recurring: null,
            addedBy: 'mira'
        },
        {
            id: 'p02',
            list: 'pharma',
            name: 'Vitamin D',
            category: 'pharmacy',
            checked: false,
            store: null,
            recurring: 'monthly',
            addedBy: 'you'
        },
        {
            id: 'p03',
            list: 'pharma',
            name: 'Band-aids',
            category: 'pharmacy',
            checked: true,
            store: null,
            recurring: null,
            addedBy: 'you'
        },
        {
            id: 'p04',
            list: 'pharma',
            name: 'Sunscreen SPF 50',
            category: 'pharmacy',
            checked: false,
            store: 'CVS',
            recurring: null,
            addedBy: 'mira'
        },

        // Hardware
        {
            id: 'h01',
            list: 'hardware',
            name: 'M6 wood screws',
            category: 'household',
            checked: false,
            store: 'Home Depot',
            recurring: null,
            addedBy: 'you'
        },
        {
            id: 'h02',
            list: 'hardware',
            name: 'LED bulbs E27',
            category: 'household',
            checked: false,
            store: 'Home Depot',
            recurring: null,
            addedBy: 'you'
        },
        {
            id: 'h03',
            list: 'hardware',
            name: 'Painter\u2019s tape',
            category: 'household',
            checked: true,
            store: null,
            recurring: null,
            addedBy: 'leo'
        },

        // IKEA run
        {
            id: 'k01',
            list: 'ikea',
            name: 'Curtain rods',
            category: 'household',
            checked: false,
            store: 'IKEA',
            recurring: null,
            addedBy: 'you'
        },
        {
            id: 'k02',
            list: 'ikea',
            name: 'Picture frames x3',
            category: 'household',
            checked: false,
            store: 'IKEA',
            recurring: null,
            addedBy: 'mira'
        },
        {
            id: 'k03',
            list: 'ikea',
            name: 'Tealights',
            category: 'household',
            checked: false,
            store: 'IKEA',
            recurring: 'monthly',
            addedBy: 'you'
        },
    ];

    const members = [
        {id: 'you', name: 'You', initial: 'Y', color: '#2AA396'},
        {id: 'mira', name: 'Mira', initial: 'M', color: '#F0A93D'},
        {id: 'leo', name: 'Leo', initial: 'L', color: '#8E5BD9'},
    ];

    return {categories, lists, items, members};
})();
