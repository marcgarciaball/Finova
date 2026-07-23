-- ---------------------------------------------------------------------------
-- Hand-written: split three generic-"Other" default rules into their own
-- named categories, per user feedback that Bizum/transfer/unmatched-card
-- transactions shouldn't be dumped into "Other expense"/"Other income":
--   - 'bizum_expense'       (income sibling 'bizum_income' already exists,
--                            added in 0025) — Bizum payments sent.
--   - 'transactions_expense' / 'transactions_income' — generic bank
--     transfers and direct debits (not Bizum-specific).
--   - 'card_transaction'    — last-resort category for a card purchase
--     ("COMPRA TARJ.") that matched no merchant-specific rule.
-- Mirrors packages/domain/src/categories/defaults.ts and rules/defaults.ts —
-- keep the three in sync. Like 0010/0012/0023/0024/0025, this migration
-- BACKFILLS every existing user (new category rows + re-seeded rules) and
-- additionally moves already-categorized transactions off the old
-- 'other_expense'/'other_income' catch-alls.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.seed_default_categories(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Top-level categories.
  INSERT INTO public.categories (user_id, name, name_key, kind, is_default, icon_name, color) VALUES
    (p_user_id, 'Housing',            'housing',              'expense', true, 'Home',           'var(--cat-blue)'),
    (p_user_id, 'Food & Dining',      'food',                 'expense', true, 'Utensils',       'var(--cat-teal)'),
    (p_user_id, 'Transport',          'transport',            'expense', true, 'Car',            'var(--cat-violet)'),
    (p_user_id, 'Utilities',          'utilities',            'expense', true, 'Zap',            'var(--cat-amber)'),
    (p_user_id, 'Health',             'health',               'expense', true, 'HeartPulse',     'var(--cat-rose)'),
    (p_user_id, 'Shopping',           'shopping',             'expense', true, 'ShoppingBag',    'var(--cat-lime)'),
    (p_user_id, 'Entertainment',      'entertainment',        'expense', true, 'Gamepad2',       'var(--cat-blue)'),
    (p_user_id, 'Education',          'education',            'expense', true, 'GraduationCap',  'var(--cat-teal)'),
    (p_user_id, 'Travel',             'travel',               'expense', true, 'Plane',          'var(--cat-violet)'),
    (p_user_id, 'Bizum',              'bizum_expense',        'expense', true, 'ArrowLeftRight', 'var(--cat-rose)'),
    (p_user_id, 'Transactions',       'transactions_expense', 'expense', true, 'Landmark',       'var(--cat-lime)'),
    (p_user_id, 'Card transaction',   'card_transaction',     'expense', true, 'CreditCard',     'var(--cat-blue)'),
    (p_user_id, 'Other',              'other_expense',        'expense', true, 'CircleDashed',   'var(--cat-amber)'),
    (p_user_id, 'Salary',             'salary',               'income',  true, 'Wallet',         'var(--cat-rose)'),
    (p_user_id, 'Gifts',              'gifts',                'income',  true, 'Gift',           'var(--cat-lime)'),
    (p_user_id, 'Other income',      'other_income',         'income',  true, 'CircleDashed',   'var(--cat-blue)'),
    (p_user_id, 'Bizum',              'bizum_income',         'income',  true, 'ArrowLeftRight', 'var(--cat-teal)'),
    (p_user_id, 'Transactions',       'transactions_income',  'income',  true, 'Landmark',       'var(--cat-violet)')
  ON CONFLICT (user_id, name_key) WHERE name_key IS NOT NULL DO NOTHING;

  -- Subcategories — parent resolved by name_key; kind inherited from parent.
  INSERT INTO public.categories (user_id, parent_id, name, name_key, kind, is_default, icon_name, color)
  SELECT p_user_id, p.id, v.name, v.name_key, p.kind, true, v.icon_name, p.color
  FROM (VALUES
    ('rent',        'Rent',        'housing', 'Home'),
    ('mortgage',    'Mortgage',    'housing', 'Home'),
    ('groceries',   'Groceries',   'food',    'ShoppingCart'),
    ('restaurants', 'Restaurants', 'food',    'UtensilsCrossed')
  ) AS v(name_key, name, parent_key, icon_name)
  JOIN public.categories p
    ON p.user_id = p_user_id AND p.name_key = v.parent_key AND p.parent_id IS NULL
  ON CONFLICT (user_id, name_key) WHERE name_key IS NOT NULL DO NOTHING;
END;
$$;--> statement-breakpoint

-- Backfill: give existing users the three new categories too (the seed
-- function only fires for new signups via the auth trigger).
INSERT INTO public.categories (user_id, name, name_key, kind, is_default, icon_name, color)
SELECT DISTINCT user_id, 'Bizum', 'bizum_expense', 'expense', true, 'ArrowLeftRight', 'var(--cat-rose)'
FROM public.categories
ON CONFLICT (user_id, name_key) WHERE name_key IS NOT NULL DO NOTHING;--> statement-breakpoint

INSERT INTO public.categories (user_id, name, name_key, kind, is_default, icon_name, color)
SELECT DISTINCT user_id, 'Transactions', 'transactions_expense', 'expense', true, 'Landmark', 'var(--cat-lime)'
FROM public.categories
ON CONFLICT (user_id, name_key) WHERE name_key IS NOT NULL DO NOTHING;--> statement-breakpoint

INSERT INTO public.categories (user_id, name, name_key, kind, is_default, icon_name, color)
SELECT DISTINCT user_id, 'Card transaction', 'card_transaction', 'expense', true, 'CreditCard', 'var(--cat-blue)'
FROM public.categories
ON CONFLICT (user_id, name_key) WHERE name_key IS NOT NULL DO NOTHING;--> statement-breakpoint

INSERT INTO public.categories (user_id, name, name_key, kind, is_default, icon_name, color)
SELECT DISTINCT user_id, 'Transactions', 'transactions_income', 'income', true, 'Landmark', 'var(--cat-violet)'
FROM public.categories
ON CONFLICT (user_id, name_key) WHERE name_key IS NOT NULL DO NOTHING;--> statement-breakpoint

-- Re-point the affected default rules at their new categories instead of
-- 'other_expense'/'other_income', and add the 'card_transaction_fallback'
-- rule (full re-seed list, mirrors rules/defaults.ts + 0025).
CREATE OR REPLACE FUNCTION public.seed_default_rules(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.categorization_rules
    (user_id, name, name_key, conditions, category_id, priority, is_default)
  SELECT
    p_user_id,
    v.name,
    v.name_key,
    jsonb_build_array(
      jsonb_build_object('field', 'description', 'op', 'contains', 'value', v.token)
    ),
    c.id,
    v.priority,
    true
  FROM (VALUES
    ('mercadona', 'Mercadona', 'groceries', 'mercadona', 100),
    ('carrefour', 'Carrefour', 'groceries', 'carrefour', 101),
    ('lidl', 'Lidl', 'groceries', 'lidl', 102),
    ('dia', 'Dia', 'groceries', 'supermercado dia', 103),
    ('aldi', 'Aldi', 'groceries', 'aldi', 104),
    ('consum', 'Consum', 'groceries', 'consum', 105),
    ('eroski', 'Eroski', 'groceries', 'eroski', 106),
    ('glovo', 'Glovo', 'restaurants', 'glovo', 110),
    ('uber_eats', 'Uber Eats', 'restaurants', 'uber eats', 111),
    ('just_eat', 'Just Eat', 'restaurants', 'just eat', 112),
    ('deliveroo', 'Deliveroo', 'restaurants', 'deliveroo', 113),
    ('mcdonalds', 'McDonald''s', 'restaurants', 'mcdonald', 114),
    ('starbucks', 'Starbucks', 'restaurants', 'starbucks', 115),
    ('telepizza', 'Telepizza', 'restaurants', 'telepizza', 116),
    ('uber', 'Uber', 'transport', 'uber', 120),
    ('cabify', 'Cabify', 'transport', 'cabify', 121),
    ('renfe', 'Renfe', 'transport', 'renfe', 122),
    ('repsol', 'Repsol', 'transport', 'repsol', 123),
    ('cepsa', 'Cepsa', 'transport', 'cepsa', 124),
    ('endesa', 'Endesa', 'utilities', 'endesa', 130),
    ('iberdrola', 'Iberdrola', 'utilities', 'iberdrola', 131),
    ('naturgy', 'Naturgy', 'utilities', 'naturgy', 132),
    ('movistar', 'Movistar', 'utilities', 'movistar', 133),
    ('vodafone', 'Vodafone', 'utilities', 'vodafone', 134),
    ('orange', 'Orange', 'utilities', 'orange', 135),
    ('nomina', 'Payroll (Nómina)', 'salary', 'nomina', 140),
    ('payroll', 'Payroll', 'salary', 'payroll', 141),
    ('alcampo', 'Alcampo', 'groceries', 'alcampo', 150),
    ('hipercor', 'Hipercor', 'groceries', 'hipercor', 151),
    ('condis', 'Condis', 'groceries', 'condis', 152),
    ('bonpreu', 'Bonpreu', 'groceries', 'bonpreu', 153),
    ('walmart', 'Walmart', 'groceries', 'walmart', 154),
    ('tesco', 'Tesco', 'groceries', 'tesco', 155),
    ('supermercado', 'Supermarket', 'groceries', 'supermercado', 156),
    ('fruteria', 'Greengrocer', 'groceries', 'fruteria', 157),
    ('panaderia', 'Bakery', 'groceries', 'panaderia', 158),
    ('burger_king', 'Burger King', 'restaurants', 'burger king', 160),
    ('kfc', 'KFC', 'restaurants', 'kfc', 161),
    ('dominos', 'Domino''s', 'restaurants', 'domino', 162),
    ('pizza_hut', 'Pizza Hut', 'restaurants', 'pizza hut', 163),
    ('taco_bell', 'Taco Bell', 'restaurants', 'taco bell', 164),
    ('doordash', 'DoorDash', 'restaurants', 'doordash', 165),
    ('costa_coffee', 'Costa Coffee', 'restaurants', 'costa coffee', 166),
    ('dunkin', 'Dunkin', 'restaurants', 'dunkin', 167),
    ('restaurante', 'Restaurant', 'restaurants', 'restaurante', 168),
    ('cafeteria', 'Café', 'restaurants', 'cafeteria', 169),
    ('pizzeria', 'Pizzeria', 'restaurants', 'pizzeria', 170),
    ('sushi', 'Sushi', 'restaurants', 'sushi', 171),
    ('hamburgueseria', 'Burger joint', 'restaurants', 'hamburgueseria', 172),
    ('cerveceria', 'Beer hall', 'restaurants', 'cerveceria', 173),
    ('shell', 'Shell', 'transport', 'shell', 180),
    ('galp', 'Galp', 'transport', 'galp', 181),
    ('gasolinera', 'Gas station', 'transport', 'gasolinera', 182),
    ('parking', 'Parking', 'transport', 'parking', 183),
    ('aparcamiento', 'Car park', 'transport', 'aparcamiento', 184),
    ('peaje', 'Toll (peaje)', 'transport', 'peaje', 185),
    ('metro', 'Metro', 'transport', 'metro ', 186),
    ('autobus', 'Bus', 'transport', 'autobus', 187),
    ('cercanias', 'Cercanías', 'transport', 'cercanias', 188),
    ('bicing', 'Bicing', 'transport', 'bicing', 189),
    ('taxi', 'Taxi', 'transport', 'taxi', 190),
    ('freenow', 'Free Now', 'transport', 'freenow', 191),
    ('blablacar', 'BlaBlaCar', 'transport', 'blablacar', 192),
    ('holaluz', 'Holaluz', 'utilities', 'holaluz', 200),
    ('jazztel', 'Jazztel', 'utilities', 'jazztel', 201),
    ('masmovil', 'MásMóvil', 'utilities', 'masmovil', 202),
    ('yoigo', 'Yoigo', 'utilities', 'yoigo', 203),
    ('digi', 'Digi', 'utilities', 'digi', 204),
    ('electricidad', 'Electricity', 'utilities', 'electricidad', 205),
    ('internet', 'Internet', 'utilities', 'internet', 206),
    ('telefonia', 'Telecom', 'utilities', 'telefonia', 207),
    ('canal_de_isabel', 'Canal de Isabel II', 'utilities', 'canal de isabel', 208),
    ('farmacia', 'Pharmacy', 'health', 'farmacia', 220),
    ('pharmacy', 'Pharmacy', 'health', 'pharmacy', 221),
    ('sanitas', 'Sanitas', 'health', 'sanitas', 222),
    ('adeslas', 'Adeslas', 'health', 'adeslas', 223),
    ('asisa', 'Asisa', 'health', 'asisa', 224),
    ('dkv', 'DKV', 'health', 'dkv', 225),
    ('gimnasio', 'Gym', 'health', 'gimnasio', 226),
    ('fisioterapia', 'Physiotherapy', 'health', 'fisioterapia', 227),
    ('dentista', 'Dentist', 'health', 'dentista', 228),
    ('clinica', 'Clinic', 'health', 'clinica', 229),
    ('hospital', 'Hospital', 'health', 'hospital', 230),
    ('zara', 'Zara', 'shopping', 'zara', 240),
    ('hym', 'H&M', 'shopping', 'h&m', 241),
    ('primark', 'Primark', 'shopping', 'primark', 242),
    ('zalando', 'Zalando', 'shopping', 'zalando', 243),
    ('ikea', 'IKEA', 'shopping', 'ikea', 244),
    ('leroy_merlin', 'Leroy Merlin', 'shopping', 'leroy merlin', 245),
    ('mediamarkt', 'MediaMarkt', 'shopping', 'mediamarkt', 246),
    ('fnac', 'Fnac', 'shopping', 'fnac', 247),
    ('amazon', 'Amazon', 'shopping', 'amazon', 248),
    ('el_corte_ingles', 'El Corte Inglés', 'shopping', 'el corte ingles', 249),
    ('aliexpress', 'AliExpress', 'shopping', 'aliexpress', 250),
    ('decathlon', 'Decathlon', 'shopping', 'decathlon', 251),
    ('netflix', 'Netflix', 'entertainment', 'netflix', 260),
    ('spotify', 'Spotify', 'entertainment', 'spotify', 261),
    ('hbo_max', 'HBO Max', 'entertainment', 'hbo max', 262),
    ('disney_plus', 'Disney+', 'entertainment', 'disney+', 263),
    ('dazn', 'DAZN', 'entertainment', 'dazn', 264),
    ('playstation', 'PlayStation', 'entertainment', 'playstation', 265),
    ('xbox', 'Xbox', 'entertainment', 'xbox', 266),
    ('nintendo', 'Nintendo', 'entertainment', 'nintendo', 267),
    ('cine', 'Cinema', 'entertainment', 'cine ', 268),
    ('teatro', 'Theatre', 'entertainment', 'teatro', 269),
    ('ticketmaster', 'Ticketmaster', 'entertainment', 'ticketmaster', 270),
    ('filmin', 'Filmin', 'entertainment', 'filmin', 271),
    ('udemy', 'Udemy', 'education', 'udemy', 280),
    ('coursera', 'Coursera', 'education', 'coursera', 281),
    ('duolingo', 'Duolingo', 'education', 'duolingo', 282),
    ('universidad', 'University', 'education', 'universidad', 283),
    ('matricula', 'Tuition (matrícula)', 'education', 'matricula', 284),
    ('masterclass', 'MasterClass', 'education', 'masterclass', 285),
    ('iberia', 'Iberia', 'travel', 'iberia', 290),
    ('ryanair', 'Ryanair', 'travel', 'ryanair', 291),
    ('vueling', 'Vueling', 'travel', 'vueling', 292),
    ('easyjet', 'EasyJet', 'travel', 'easyjet', 293),
    ('booking_com', 'Booking.com', 'travel', 'booking.com', 294),
    ('airbnb', 'Airbnb', 'travel', 'airbnb', 295),
    ('hostelworld', 'Hostelworld', 'travel', 'hostelworld', 296),
    ('expedia', 'Expedia', 'travel', 'expedia', 297),
    ('hertz', 'Hertz', 'travel', 'hertz', 298),
    ('avis', 'Avis', 'travel', 'avis ', 299),
    ('europcar', 'Europcar', 'travel', 'europcar', 300),
    ('sixt', 'Sixt', 'travel', 'sixt', 301),
    ('aeropuerto', 'Airport', 'travel', 'aeropuerto', 302),
    ('hotel', 'Hotel', 'travel', 'hotel ', 303),
    ('mapfre', 'Mapfre', 'other_expense', 'mapfre', 310),
    ('axa', 'AXA', 'other_expense', 'axa', 311),
    ('linea_directa', 'Línea Directa', 'other_expense', 'linea directa', 312),
    ('mutua_madrilena', 'Mutua Madrileña', 'other_expense', 'mutua madrilena', 313),
    ('zurich_seguros', 'Zurich Seguros', 'other_expense', 'zurich seguros', 314),
    ('seguro_coche', 'Car insurance', 'other_expense', 'seguro coche', 315),
    ('seguro_hogar', 'Home insurance', 'other_expense', 'seguro hogar', 316),
    ('sueldo', 'Salary (sueldo)', 'salary', 'sueldo', 320),
    ('salario', 'Salary', 'salary', 'salario', 321),
    ('paycheck', 'Paycheck', 'salary', 'paycheck', 322),
    ('regalo', 'Gift (regalo)', 'gifts', 'regalo', 330),
    ('herencia', 'Inheritance', 'gifts', 'herencia', 331),
    ('donacion', 'Donation', 'gifts', 'donacion', 332),
    ('factura_emitida', 'Invoice issued', 'other_income', 'factura emitida', 340),
    ('freelance', 'Freelance', 'other_income', 'freelance', 341),
    ('dividendo', 'Dividend', 'other_income', 'dividendo', 342),
    ('dividend', 'Dividend', 'other_income', 'dividend', 343),
    ('devolucion', 'Refund (devolución)', 'other_income', 'devolucion', 344),
    ('reembolso', 'Reimbursement', 'other_income', 'reembolso', 345),
    ('cashback', 'Cashback', 'other_income', 'cashback', 346),
    ('bizum_recibido', 'Bizum received', 'bizum_income', 'bizum recibido', 347),
    ('subsidio', 'Subsidy', 'other_income', 'subsidio', 348),
    ('salary', 'Salary (salary)', 'salary', 'salary', 350),
    ('supermarket', 'Supermarket (EN)', 'groceries', 'supermarket', 351),
    ('grocery', 'Grocery', 'groceries', 'grocery', 352),
    ('coffee', 'Coffee shop', 'restaurants', 'coffee', 353),
    ('restaurant', 'Restaurant (EN)', 'restaurants', 'restaurant', 354),
    ('gym', 'Gym (EN)', 'health', 'gym', 355),
    ('electricity', 'Electricity (EN)', 'utilities', 'electricity', 356),
    ('plenergy', 'Plenergy', 'transport', 'plenergy', 360),
    ('cortefiel', 'Cortefiel', 'shopping', 'cortefiel', 361),
    ('paypal', 'PayPal', 'shopping', 'paypal', 362),
    ('irpf', 'Income tax (IRPF)', 'other_expense', 'irpf', 363),
    ('itv', 'Vehicle inspection (ITV)', 'other_expense', 'itv', 364),
    ('impuestos', 'Taxes (impuestos)', 'other_expense', 'impuestos', 365),
    ('abono_bizum', 'Bizum received', 'bizum_income', 'abono bizum', 366),
    ('pago_bizum', 'Bizum sent', 'bizum_expense', 'pago bizum', 367),
    ('transferencia_a', 'Transfer sent', 'transactions_expense', 'transferencia a ', 368),
    ('abono_transferencia', 'Transfer received', 'transactions_income', 'abono transferencia', 369),
    ('adeudo_recibo', 'Direct debit (adeudo recibo)', 'transactions_expense', 'adeudo recibo', 370),
    ('bar', 'Bar', 'restaurants', 'bar ', 371),
    ('card_transaction_fallback', 'Card transaction', 'card_transaction', 'compra tarj', 990)
  ) AS v(name_key, name, category_key, token, priority)
  JOIN public.categories c
    ON c.user_id = p_user_id AND c.name_key = v.category_key
  ON CONFLICT (user_id, name_key) WHERE name_key IS NOT NULL DO NOTHING;
END;
$$;--> statement-breakpoint

-- Existing default rules keep whatever category_id they were created with
-- (ON CONFLICT DO NOTHING above only inserts missing ones) — repoint the four
-- affected rules explicitly for users who already have them.
UPDATE public.categorization_rules r
SET category_id = new_cat.id
FROM public.categories new_cat
WHERE r.name_key = 'pago_bizum'
  AND r.is_default = true
  AND new_cat.user_id = r.user_id
  AND new_cat.name_key = 'bizum_expense';--> statement-breakpoint

UPDATE public.categorization_rules r
SET category_id = new_cat.id
FROM public.categories new_cat
WHERE r.name_key IN ('transferencia_a', 'adeudo_recibo')
  AND r.is_default = true
  AND new_cat.user_id = r.user_id
  AND new_cat.name_key = 'transactions_expense';--> statement-breakpoint

UPDATE public.categorization_rules r
SET category_id = new_cat.id
FROM public.categories new_cat
WHERE r.name_key = 'abono_transferencia'
  AND r.is_default = true
  AND new_cat.user_id = r.user_id
  AND new_cat.name_key = 'transactions_income';--> statement-breakpoint

-- Backfill: move already-categorized transactions off 'other_expense' /
-- 'other_income' into their new dedicated categories — same reasoning as
-- above, applied to existing data (rule/category changes never retroactively
-- touch old rows).
UPDATE public.transactions t
SET category_id = new_cat.id
FROM public.categories old_cat, public.categories new_cat
WHERE t.category_id = old_cat.id
  AND old_cat.user_id = t.user_id
  AND old_cat.name_key = 'other_expense'
  AND new_cat.user_id = t.user_id
  AND new_cat.name_key = 'bizum_expense'
  AND lower(t.description) LIKE '%pago bizum%';--> statement-breakpoint

UPDATE public.transactions t
SET category_id = new_cat.id
FROM public.categories old_cat, public.categories new_cat
WHERE t.category_id = old_cat.id
  AND old_cat.user_id = t.user_id
  AND old_cat.name_key = 'other_expense'
  AND new_cat.user_id = t.user_id
  AND new_cat.name_key = 'transactions_expense'
  AND (
    lower(t.description) LIKE '%transferencia a %'
    OR lower(t.description) LIKE '%adeudo recibo%'
  );--> statement-breakpoint

UPDATE public.transactions t
SET category_id = new_cat.id
FROM public.categories old_cat, public.categories new_cat
WHERE t.category_id = old_cat.id
  AND old_cat.user_id = t.user_id
  AND old_cat.name_key = 'other_income'
  AND new_cat.user_id = t.user_id
  AND new_cat.name_key = 'transactions_income'
  AND lower(t.description) LIKE '%abono transferencia%';--> statement-breakpoint

-- Backfill: any still-uncategorized card purchase ("COMPRA TARJ.") that
-- matched no default rule at import time now falls under 'card_transaction'
-- instead of staying uncategorized.
UPDATE public.transactions t
SET category_id = new_cat.id
FROM public.categories new_cat
WHERE t.category_id IS NULL
  AND new_cat.user_id = t.user_id
  AND new_cat.name_key = 'card_transaction'
  AND lower(t.description) LIKE '%compra tarj%';
