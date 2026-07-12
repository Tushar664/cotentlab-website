# CoTent Lab Website — Deploy Guide (5 minute ka kaam)

## Option A: Netlify Drop (SABSE EASY — bina account setup ke bhi chal jata hai)

1. Browser mein kholo: **https://app.netlify.com/drop**
2. Ye poora folder (jisme index.html hai) drag karke page pe chhod do
3. Bas! 10 second mein live URL mil jayegi (jaise `random-name-123.netlify.app`)
4. URL change karni ho: Site settings → Change site name → `cotentlab` likh do
   → ab URL hogi: `cotentlab.netlify.app`

## Option B: Vercel (GitHub ke saath — recommended for long term)

### Step 1: GitHub pe files daalo
1. https://github.com → login → right-top **+** → **New repository**
2. Repository name: `cotentlab-website` → **Create repository**
3. Page pe "uploading an existing file" link pe click karo
4. Is folder ki files (index.html, style.css, script.js) drag-drop karo
5. Neeche **Commit changes** button dabao

### Step 2: Vercel se connect karo
1. https://vercel.com → **Sign Up** → "Continue with GitHub" chuno
2. Dashboard pe **Add New → Project**
3. `cotentlab-website` repo ke saamne **Import** dabao
4. Kuch bhi mat chhedo (Framework: Other, baaki sab default)
5. **Deploy** dabao → 30 second mein live!
   URL milegi: `cotentlab-website.vercel.app`

### Step 3 (baad mein): Custom domain
1. Vercel project → Settings → Domains → apna domain add karo (e.g. cotentlab.in)
2. Vercel jo DNS records dikhaye:
   - A record → `76.76.21.21`
   - CNAME (www) → `cname.vercel-dns.com`
3. Ye records apne domain provider (GoDaddy/Hostinger/etc.) ke
   DNS settings mein daal do → 10-30 min mein live + free SSL

## Launch se pehle ye 3 cheezein update karni hain

1. **WhatsApp number**: index.html mein `wa.me/910000000000` search karke
   apna number daalo (91 + 10 digit, bina + ke)
2. **Booking link**: "Book Free Growth Diagnosis" button ka href="#" hai —
   apna Calendly/booking link daalo
3. **Creator images**: abhi creatorlabs.in se load ho rahi hain (kaam karengi).
   Better hai ki images download karke is folder mein `images/` naam ka
   folder banake daal do, phir index.html mein
   `https://creatorlabs.in/wp-content/uploads/2026/06/` ko `images/`
   se replace kar do (VS Code mein Ctrl+H se ek baar mein ho jayega).

## Updates kaise karein (Vercel wale route mein)

Jab bhi nayi file milegi:
GitHub repo → file pe click → pencil icon (edit) → naya content paste →
Commit → Vercel automatically 30 sec mein nayi version deploy kar dega. ✨
