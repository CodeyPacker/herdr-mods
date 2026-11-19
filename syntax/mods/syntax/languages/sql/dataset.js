// The practice database. Every check restores this data before running an answer, so
// answers can change it freely. Two domains share it: a store (customers, orders, products)
// and a company (departments, employees, projects). UI-safe: no Node imports.

/** CREATE TABLE statements, in dependency order. Exercises show the ones they use. @type {Record<string, string>} */
export const tableSql = {
  categories: `CREATE TABLE categories (
  id        integer PRIMARY KEY,
  name      text NOT NULL,
  parent_id integer REFERENCES categories (id)
);`,
  products: `CREATE TABLE products (
  id           integer PRIMARY KEY,
  name         text NOT NULL,
  category_id  integer REFERENCES categories (id),
  price        numeric(8, 2) NOT NULL,
  stock        integer NOT NULL,
  discontinued boolean NOT NULL DEFAULT false,
  tags         text[] NOT NULL DEFAULT '{}',
  attributes   jsonb NOT NULL DEFAULT '{}',
  added_on     date NOT NULL
);`,
  customers: `CREATE TABLE customers (
  id          integer PRIMARY KEY,
  first_name  text NOT NULL,
  last_name   text NOT NULL,
  email       text UNIQUE,
  city        text NOT NULL,
  country     text NOT NULL,
  signup_date date NOT NULL,
  referred_by integer REFERENCES customers (id)
);`,
  orders: `CREATE TABLE orders (
  id          integer PRIMARY KEY,
  customer_id integer NOT NULL REFERENCES customers (id),
  ordered_at  timestamp NOT NULL,
  status      text NOT NULL CHECK (status IN ('pending', 'shipped', 'delivered', 'cancelled')),
  shipped_at  timestamp
);`,
  order_items: `CREATE TABLE order_items (
  order_id   integer NOT NULL REFERENCES orders (id),
  product_id integer NOT NULL REFERENCES products (id),
  quantity   integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(8, 2) NOT NULL,
  PRIMARY KEY (order_id, product_id)
);`,
  reviews: `CREATE TABLE reviews (
  id          integer PRIMARY KEY,
  product_id  integer NOT NULL REFERENCES products (id),
  customer_id integer NOT NULL REFERENCES customers (id),
  rating      integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body        text,
  reviewed_on date NOT NULL
);`,
  events: `CREATE TABLE events (
  id          integer PRIMARY KEY,
  customer_id integer NOT NULL REFERENCES customers (id),
  kind        text NOT NULL,
  payload     jsonb NOT NULL,
  occurred_at timestamp NOT NULL
);`,
  departments: `CREATE TABLE departments (
  id       integer PRIMARY KEY,
  name     text NOT NULL UNIQUE,
  location text NOT NULL,
  budget   numeric(12, 2) NOT NULL
);`,
  employees: `CREATE TABLE employees (
  id            integer PRIMARY KEY,
  first_name    text NOT NULL,
  last_name     text NOT NULL,
  email         text NOT NULL UNIQUE,
  title         text NOT NULL,
  department_id integer REFERENCES departments (id),
  manager_id    integer REFERENCES employees (id),
  salary        numeric(10, 2) NOT NULL,
  bonus_pct     numeric(4, 2),
  hired_on      date NOT NULL,
  skills        text[] NOT NULL DEFAULT '{}'
);`,
  projects: `CREATE TABLE projects (
  id            integer PRIMARY KEY,
  name          text NOT NULL,
  department_id integer NOT NULL REFERENCES departments (id),
  started_on    date NOT NULL,
  ended_on      date,
  budget        numeric(12, 2) NOT NULL
);`,
  assignments: `CREATE TABLE assignments (
  employee_id integer NOT NULL REFERENCES employees (id),
  project_id  integer NOT NULL REFERENCES projects (id),
  role        text NOT NULL,
  hours       integer NOT NULL,
  PRIMARY KEY (employee_id, project_id)
);`,
};

/** The CREATE TABLE text for the named tables, shown beside an exercise. @param {...string} names */
export function tables(...names) {
  return names.map(name => {
    if (!(name in tableSql)) throw new Error(`Unknown practice table: ${name}`);
    return tableSql[name];
  }).join("\n\n");
}

const categories = [
  [1, "Electronics", null], [2, "Computers", 1], [3, "Laptops", 2], [4, "Accessories", 2], [5, "Audio", 1],
  [6, "Headphones", 5], [7, "Home", null], [8, "Kitchen", 7], [9, "Furniture", 7], [10, "Books", null],
  [11, "Fiction", 10], [12, "Technical", 10],
];

/** @typedef {string | number | boolean | null | string[] | Record<string, unknown>} Value */

// id, name, category, price, stock, discontinued, tags, attributes, added_on
/** @type {any[][]} */
const products = [
  [1, "Aero 13 Laptop", 3, "1199.00", 8, false, ["portable", "premium"], { color: "silver", weight_kg: 1.2, warranty_years: 2 }, "2024-02-10"],
  [2, "Forge 16 Laptop", 3, "1649.00", 4, false, ["gaming", "premium"], { color: "black", weight_kg: 2.4, warranty_years: 2 }, "2024-05-03"],
  [3, "Scout 14 Laptop", 3, "749.00", 0, true, ["budget"], { color: "gray", weight_kg: 1.6, warranty_years: 1 }, "2023-09-18"],
  [4, "Wireless Mouse", 4, "29.99", 120, false, ["wireless"], { color: "black", battery: "AA" }, "2023-11-02"],
  [5, "Mechanical Keyboard", 4, "89.50", 45, false, ["wired", "rgb"], { color: "white", switches: "brown" }, "2024-01-15"],
  [6, "USB-C Hub", 4, "39.00", 0, false, ["portable"], { ports: 7 }, "2024-03-22"],
  [7, "27in Monitor", 2, "329.00", 15, false, ["4k"], { color: "black", size_in: 27 }, "2024-04-01"],
  [8, "Studio Headphones", 6, "199.00", 22, false, ["wired", "premium"], { color: "black", wireless: false }, "2023-12-05"],
  [9, "Travel Earbuds", 6, "79.00", 60, false, ["wireless", "portable"], { color: "white", wireless: true }, "2024-06-12"],
  [10, "Bluetooth Speaker", 5, "59.00", 33, false, ["wireless", "portable"], { color: "blue", wireless: true }, "2024-02-28"],
  [11, "Soundbar", 5, "249.00", 7, true, ["wired"], { color: "black", wireless: false }, "2023-08-14"],
  [12, "Chef Knife", 8, "64.00", 40, false, ["steel"], { length_cm: 20 }, "2024-03-09"],
  [13, "Cast Iron Skillet", 8, "45.00", 25, false, ["cast-iron"], { diameter_cm: 26, weight_kg: 2.7 }, "2023-10-21"],
  [14, "Espresso Machine", 8, "499.00", 5, false, ["premium"], { color: "silver", warranty_years: 2 }, "2024-07-01"],
  [15, "French Press", 8, "32.00", 0, false, ["glass"], { capacity_ml: 1000 }, "2023-07-30"],
  [16, "Standing Desk", 9, "549.00", 9, false, ["adjustable", "premium"], { color: "oak", width_cm: 160 }, "2024-01-08"],
  [17, "Office Chair", 9, "289.00", 14, false, ["adjustable"], { color: "gray" }, "2024-02-19"],
  [18, "Bookshelf", 9, "120.00", 11, false, [], { color: "white", shelves: 5 }, "2023-06-11"],
  [19, "The Long Orbit", 11, "18.99", 70, false, ["paperback"], { pages: 412, author: "M. Reyes" }, "2024-05-20"],
  [20, "Quiet Harbor", 11, "14.50", 0, true, ["paperback"], { pages: 288, author: "L. Okafor" }, "2023-04-02"],
  [21, "SQL in Practice", 12, "42.00", 38, false, ["hardcover"], { pages: 520, author: "D. Lindqvist" }, "2024-04-15"],
  [22, "Designing Systems", 12, "54.00", 19, false, ["hardcover"], { pages: 610, author: "A. Moreau" }, "2024-08-09"],
  [23, "Gift Card", null, "50.00", 999, false, ["digital"], {}, "2023-01-01"],
  [24, "Laptop Sleeve", 4, "24.00", 52, false, ["portable"], { color: "gray", fits_in: 14 }, "2024-06-30"],
];

// id, first, last, email, city, country, signup, referred_by
const customers = [
  [1, "Ava", "Martinez", "ava.martinez@example.com", "Denver", "USA", "2023-02-14", null],
  [2, "Noah", "Kim", "noah.kim@example.com", "Seattle", "USA", "2023-03-02", 1],
  [3, "Mia", "Chen", "mia.chen@example.com", "Toronto", "Canada", "2023-04-19", null],
  [4, "Liam", "Johnson", null, "Denver", "USA", "2023-05-07", 1],
  [5, "Zoe", "Patel", "zoe.patel@example.com", "London", "UK", "2023-06-23", null],
  [6, "Ethan", "Brown", "ethan.brown@example.com", "Austin", "USA", "2023-07-11", 2],
  [7, "Isla", "Wilson", "isla.wilson@example.com", "Manchester", "UK", "2023-08-30", 5],
  [8, "Lucas", "Garcia", "lucas.garcia@example.com", "Madrid", "Spain", "2023-09-15", null],
  [9, "Emma", "Rossi", "emma.rossi@example.com", "Milan", "Italy", "2023-10-01", 8],
  [10, "Owen", "Murphy", null, "Dublin", "Ireland", "2023-11-20", null],
  [11, "Chloe", "Dubois", "chloe.dubois@example.com", "Paris", "France", "2024-01-09", 9],
  [12, "Leo", "Schmidt", "leo.schmidt@example.com", "Berlin", "Germany", "2024-02-02", null],
  [13, "Grace", "Nguyen", "grace.nguyen@example.com", "Vancouver", "Canada", "2024-03-18", 3],
  [14, "Henry", "Taylor", "henry.taylor@example.com", "Seattle", "USA", "2024-04-25", 2],
  [15, "Lily", "Anderson", "lily.anderson@example.com", "Denver", "USA", "2024-05-30", 4],
  [16, "Jack", "Thompson", "jack.thompson@example.com", "Sydney", "Australia", "2024-07-04", null],
  [17, "Sofia", "Lopez", "sofia.lopez@example.com", "Austin", "USA", "2024-08-16", 6],
  [18, "Mason", "Clark", "mason.clark@example.com", "Toronto", "Canada", "2024-09-21", null],
  [19, "Ruby", "Hughes", null, "London", "UK", "2024-10-12", 7],
  [20, "Felix", "Wagner", "felix.wagner@example.com", "Berlin", "Germany", "2024-11-28", 12],
];

const departments = [
  [1, "Executive", "Denver", "900000.00"], [2, "Engineering", "Denver", "2400000.00"], [3, "Sales", "Chicago", "1100000.00"],
  [4, "Marketing", "Chicago", "650000.00"], [5, "Support", "Austin", "480000.00"], [6, "Legal", "Denver", "300000.00"],
];

// id, first, last, title, department, manager, salary, bonus, hired_on, skills
const employees = [
  [1, "Dana", "Whitfield", "CEO", 1, null, "310000.00", "20.00", "2015-03-01", ["strategy", "finance"]],
  [2, "Marcus", "Hale", "CTO", 2, 1, "245000.00", "15.00", "2016-07-11", ["architecture", "go", "sql"]],
  [3, "Priya", "Raman", "VP Sales", 3, 1, "210000.00", "18.00", "2017-01-23", ["negotiation"]],
  [4, "Tom", "Okafor", "Marketing Director", 4, 1, "175000.00", "10.00", "2018-04-02", ["branding", "seo"]],
  [5, "Elena", "Sokolova", "Engineering Manager", 2, 2, "185000.00", "10.00", "2017-09-18", ["sql", "python", "leadership"]],
  [6, "Ben", "Carter", "Senior Engineer", 2, 5, "158000.00", "8.00", "2018-11-05", ["typescript", "sql", "postgres"]],
  [7, "Aiko", "Tanaka", "Senior Engineer", 2, 5, "162000.00", "8.00", "2019-02-14", ["csharp", "sql"]],
  [8, "Sam", "Reed", "Engineer", 2, 5, "121000.00", null, "2021-06-01", ["typescript", "react"]],
  [9, "Nora", "Lund", "Engineer", 2, 5, "118500.00", null, "2022-03-07", ["python", "sql"]],
  [10, "Omar", "Haddad", "Engineering Manager", 2, 2, "181000.00", "10.00", "2018-08-20", ["go", "kubernetes"]],
  [11, "Grace", "Li", "Senior Engineer", 2, 10, "155000.00", "8.00", "2019-10-28", ["go", "postgres"]],
  [12, "Diego", "Alvarez", "Engineer", 2, 10, "112000.00", null, "2023-01-16", ["go"]],
  [13, "Hannah", "Moore", "Account Executive", 3, 3, "98000.00", "25.00", "2020-05-11", ["negotiation", "crm"]],
  [14, "Ravi", "Shah", "Account Executive", 3, 3, "101000.00", "25.00", "2019-07-29", ["crm"]],
  [15, "Julia", "Becker", "Sales Associate", 3, 13, "64000.00", "12.00", "2023-09-04", ["crm"]],
  [16, "Kofi", "Mensah", "Content Strategist", 4, 4, "88000.00", null, "2021-02-22", ["seo", "writing"]],
  [17, "Laura", "Fischer", "Designer", 4, 4, "92000.00", "5.00", "2020-10-12", ["figma", "branding"]],
  [18, "Pete", "Novak", "Support Lead", 5, 1, "86000.00", "6.00", "2019-04-08", ["zendesk", "sql"]],
  [19, "Mei", "Wong", "Support Specialist", 5, 18, "58000.00", null, "2022-08-15", ["zendesk"]],
  [20, "Carlos", "Ruiz", "Support Specialist", 5, 18, "56500.00", null, "2023-11-27", ["zendesk", "spanish"]],
  [21, "Ingrid", "Berg", "Support Specialist", 5, 18, "57000.00", null, "2024-02-05", []],
  [22, "Yusuf", "Demir", "Data Analyst", 2, 5, "104000.00", "5.00", "2021-11-01", ["sql", "python", "postgres"]],
  [23, "Alex", "Rivera", "Contractor", null, 2, "95000.00", null, "2024-06-17", ["typescript"]],
  [24, "Mila", "Horvat", "Intern", 2, 6, "42000.00", null, "2025-06-02", ["python"]],
];

const projects = [
  [1, "Checkout Rewrite", 2, "2024-01-08", "2024-09-30", "450000.00"],
  [2, "Search Revamp", 2, "2024-06-03", null, "380000.00"],
  [3, "Data Platform", 2, "2023-10-02", null, "720000.00"],
  [4, "Spring Campaign", 4, "2025-02-01", "2025-05-31", "120000.00"],
  [5, "Partner Program", 3, "2024-04-15", null, "200000.00"],
  [6, "Help Center", 5, "2024-09-09", "2025-03-14", "90000.00"],
  [7, "Brand Refresh", 4, "2023-05-01", "2023-12-15", "160000.00"],
  [8, "Mobile App", 2, "2025-03-03", null, "540000.00"],
];

const assignments = [
  [5, 1, "lead", 320], [6, 1, "developer", 610], [8, 1, "developer", 540], [17, 1, "designer", 120],
  [10, 2, "lead", 280], [11, 2, "developer", 470], [12, 2, "developer", 390], [22, 2, "analyst", 150],
  [5, 3, "sponsor", 60], [7, 3, "lead", 520], [9, 3, "developer", 610], [22, 3, "analyst", 430], [6, 3, "developer", 200],
  [4, 4, "lead", 210], [16, 4, "writer", 340], [17, 4, "designer", 260],
  [3, 5, "lead", 190], [13, 5, "seller", 400], [14, 5, "seller", 380], [15, 5, "seller", 290],
  [18, 6, "lead", 240], [19, 6, "writer", 300], [20, 6, "writer", 280], [16, 6, "writer", 90],
  [4, 7, "lead", 180], [17, 7, "designer", 420],
  [10, 8, "lead", 150], [8, 8, "developer", 330], [11, 8, "developer", 210], [24, 8, "developer", 160], [23, 8, "developer", 240],
];

/** A small deterministic generator, so every machine builds identical orders. @param {number} seed */
function generator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** @param {number} value */
const pad = value => String(value).padStart(2, "0");
/** @param {number} dayOfYear @param {number} minutes */
function stamp(dayOfYear, minutes) {
  const date = new Date(Date.UTC(2025, 0, 1) + dayOfYear * 86400000 + minutes * 60000);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:00`;
}

function generated() {
  const random = generator(20250101);
  /** @template T @param {T[]} list @returns {T} */
  const pick = list => list[Math.floor(random() * list.length)];
  /** @param {number} low @param {number} high */
  const between = (low, high) => low + Math.floor(random() * (high - low + 1));
  const buyers = customers.slice(0, 17).map(row => row[0]); // 18, 19 and 20 never order.
  const orders = [], items = [];
  const sold = products.filter(row => row[0] !== 15 && row[0] !== 20); // The French Press and Quiet Harbor never sell.
  for (let id = 1; id <= 60; id++) {
    const customer = id <= 17 ? buyers[id - 1] : pick(buyers);
    const day = Math.floor((id - 1) * 5.8) + between(0, 4);
    const minutes = between(7 * 60, 22 * 60);
    const status = day > 335 ? pick(["pending", "pending", "shipped"]) : pick(["delivered", "delivered", "delivered", "shipped", "cancelled"]);
    const shipped = status === "shipped" || status === "delivered" ? stamp(day + between(1, 4), between(8 * 60, 17 * 60)) : null;
    orders.push([id, customer, stamp(day, minutes), status, shipped]);
    const count = between(1, 4);
    const chosen = new Set();
    while (chosen.size < count) chosen.add(pick(sold)[0]);
    for (const product of [...chosen].sort((a, b) => a - b)) {
      const price = Number(products[product - 1][3]);
      const discounted = random() < 0.2 ? Math.round(price * 0.9 * 100) / 100 : price;
      items.push([id, product, product === 23 ? 1 : between(1, 3), discounted.toFixed(2)]);
    }
  }
  const reviews = [];
  const bodies = ["Great value.", "Works as described.", "Stopped working after a month.", "Would buy again!", null, "Too expensive for what it is.", "Excellent build quality.", null];
  for (let id = 1; id <= 36; id++) {
    const order = pick(orders.filter(row => row[3] === "delivered"));
    const product = pick(items.filter(row => row[0] === order[0]))[1];
    const rating = pick([5, 5, 4, 4, 4, 3, 2, 1]);
    reviews.push([id, product, order[1], rating, pick(bodies), stamp(Number(String(order[2]).slice(5, 7)) * 30 - 20 + between(0, 9), 0).slice(0, 10)]);
  }
  const unique = new Map(reviews.map(row => [`${row[1]}:${row[2]}`, row]));
  const events = [];
  const pages = ["/", "/products/1", "/products/4", "/products/9", "/products/14", "/cart", "/checkout", "/search"];
  for (let id = 1; id <= 80; id++) {
    const customer = pick(buyers);
    const kind = pick(["login", "page_view", "page_view", "page_view", "add_to_cart", "search", "purchase"]);
    const device = pick(["desktop", "mobile", "mobile", "tablet"]);
    const payload = kind === "page_view" ? { page: pick(pages), device, duration_ms: between(200, 9000) }
      : kind === "add_to_cart" ? { product_id: pick(products)[0], quantity: between(1, 3), device }
      : kind === "search" ? { query: pick(["laptop", "headphones", "desk", "sql book", "espresso"]), results: between(0, 12), device }
      : kind === "purchase" ? { order_id: between(1, 60), amount: Number((between(2000, 180000) / 100).toFixed(2)), device }
      : { device, success: random() < 0.85 };
    events.push([id, customer, kind, payload, stamp(Math.floor((id - 1) * 4.5) + between(0, 3), between(0, 1439))]);
  }
  return { orders, items, reviews: [...unique.values()].sort((a, b) => a[0] - b[0]), events };
}

/** @param {Value} value @returns {string} */
function literal(value) {
  if (value === null) return "NULL";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `ARRAY[${value.map(literal).join(", ")}]::text[]`;
  if (typeof value === "object") return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
  return `'${value.replaceAll("'", "''")}'`;
}

/** @param {string} table @param {string[]} columns @param {Value[][]} rows @param {boolean} reversed */
function insertRows(table, columns, rows, reversed) {
  return `INSERT INTO ${table} (${columns.join(", ")}) VALUES\n${(reversed ? [...rows].reverse() : rows).map(row => `  (${row.map(literal).join(", ")})`).join(",\n")};`;
}

const cached = new Map();
/**
 * The full schema and data as SQL. Restored before every check and written beside answers.
 * `reversed` inserts the same rows backwards; tests use it to find answers that depend on row order.
 */
export function datasetSql({ reversed = false } = {}) {
  if (cached.has(reversed)) return cached.get(reversed);
  const { orders, items, reviews, events } = generated();
  /** @param {string} table @param {string[]} columns @param {Value[][]} rows */
  const insert = (table, columns, rows) => insertRows(table, columns, rows, reversed);
  const sql = [
    "-- Practice Range SQL dataset. Every check starts from this data.",
    ...Object.values(tableSql),
    insert("categories", ["id", "name", "parent_id"], categories),
    insert("products", ["id", "name", "category_id", "price", "stock", "discontinued", "tags", "attributes", "added_on"], products),
    insert("customers", ["id", "first_name", "last_name", "email", "city", "country", "signup_date", "referred_by"], customers),
    insert("orders", ["id", "customer_id", "ordered_at", "status", "shipped_at"], orders),
    insert("order_items", ["order_id", "product_id", "quantity", "unit_price"], items),
    insert("reviews", ["id", "product_id", "customer_id", "rating", "body", "reviewed_on"], reviews),
    insert("events", ["id", "customer_id", "kind", "payload", "occurred_at"], events),
    insert("departments", ["id", "name", "location", "budget"], departments),
    insert("employees", ["id", "first_name", "last_name", "email", "title", "department_id", "manager_id", "salary", "bonus_pct", "hired_on", "skills"],
      employees.map(([id, first, last, ...rest]) => [id, first, last, `${first}.${last}@corp.example`.toLowerCase(), ...rest])),
    insert("projects", ["id", "name", "department_id", "started_on", "ended_on", "budget"], projects),
    insert("assignments", ["employee_id", "project_id", "role", "hours"], assignments),
  ].join("\n\n") + "\n";
  cached.set(reversed, sql);
  return sql;
}
