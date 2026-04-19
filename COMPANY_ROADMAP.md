# VaxAI Vision — Company Building Roadmap

> Last updated: April 18, 2026
> This is the master roadmap. The technical roadmap (ROADMAP.md) nests inside Phase 2 and beyond.

---

## Where You Are Right Now

You have a working product — a fully functional AI-driven vaccine supply chain platform with real backend logic, ML models, and integration connectors. That puts you ahead of 90% of health-tech startups who pitch a slide deck. But a product without funding, users, partnerships, and evidence is just a side project.

This roadmap answers: **What do you do, in what order, to turn VaxAI Vision into a funded, deployed, impactful company?**

---

## Phase 0: READY THE PITCH (Now — May 2026)

**Goal:** Package what you've built into a compelling story that opens doors to funding, partnerships, and pilot sites. You cannot do everything at once — this phase is about creating leverage.

**Time commitment:** 4–6 weeks, part-time alongside any current obligations.

### 0.1 Sharpen the Story

You need three assets before you talk to anyone:

**One-pager (1 day)**
A single PDF that answers: What is VaxAI Vision? What problem does it solve? What have you built? What do you need? Who are you? Include a screenshot of the live dashboard and a link to the demo. This is what you email to funders, attach to applications, and hand to people at conferences. Keep it to one page, both sides maximum.

**Pitch deck (3–5 days)**
10–12 slides. Structure it as:
1. The problem: X million vaccine doses wasted annually in LMICs due to stockouts and cold chain failures
2. Why now: AI + mobile connectivity + DHIS2 adoption create a window
3. The solution: VaxAI Vision (live demo screenshots, not mockups)
4. How it works: Data ingestion → AI analysis → Actionable alerts
5. Traction: Working platform, 6 integration connectors, live demo at app.vaxaivision.com
6. Market: 50,000+ health facilities in sub-Saharan Africa alone
7. Business model: Grant-funded deployment → government procurement at scale
8. The ask: $250K seed to fund 5-facility pilot in [target country]
9. Team: Your background, any advisors
10. Roadmap: Phase 1 pilot → Phase 2 scale → Phase 3 platform

**Live demo script (1 day)**
A 5-minute walkthrough of the platform that you can do over Zoom or in person. Practice it until it's smooth. The fact that you have a live, working product is your biggest differentiator — most grant applicants have PowerPoints.

### 0.2 Pick Your First Country

Do not say "sub-Saharan Africa" to funders — say a specific country. Choose based on:

**Strong candidates:**
- **Kenya**: Strong digital health ecosystem, DHIS2 adoption, English-speaking, HealthTech Hub Africa in Nairobi, Villgro Africa presence, active Gavi programs
- **Rwanda**: Government prioritizes health tech, small geography (easier logistics), HealthTech Hub Africa HQ in Kigali, strong data infrastructure
- **Nigeria**: Largest market, massive need, but more complex operationally
- **Tanzania** or **Uganda**: Active Gavi programs, growing DHIS2 adoption, English-speaking

**Decision criteria:**
- Do you have any personal connections in-country? (This matters more than anything else early on)
- Is there an active DHIS2 or OpenLMIS deployment you can connect to?
- Is there an accelerator or innovation hub you can physically be at?
- What language do health workers speak at facility level?

Pick one. You can always expand later.

### 0.3 Build Your Advisory Network

You don't need a full team yet. You need 3–5 advisors who give you credibility and open doors:

- **A public health professional** who has worked in immunization programs in your target country (try LinkedIn, global health conferences, or university schools of public health)
- **A digital health researcher** at a university who can co-author your pilot study and lend institutional credibility to grant applications
- **A DHIS2/OpenLMIS technical contact** at a implementing partner (BAO Systems, BlueSquare, Ona, or the University of Oslo HISP network)
- **Someone at a funder** (even informal) who can tell you what applications actually get funded

Offer advisory equity (0.25–0.5%) or simply credit and co-authorship. Most global health professionals are mission-driven and will help if the product is real.

### 0.4 Fix the Demo Experience

Before you send anyone to the demo, make sure it works flawlessly:

- Fix the failing CI/CD deploy workflow (this is blocking live updates)
- Ensure the demo at app.vaxaivision.com loads fast and has realistic sample data
- The demo login should work instantly — no friction
- Test on a slow 3G connection (this is what funders in LMIC contexts will mentally simulate)

**Deliverables by end of Phase 0:**
- [ ] One-pager PDF
- [ ] Pitch deck (10–12 slides)
- [ ] Polished 5-minute demo script
- [ ] Target country selected with rationale
- [ ] 2–3 advisors identified and approached
- [ ] Live demo working reliably

---

## Phase 1: SECURE SEED FUNDING (June – September 2026)

**Goal:** Raise $50K–$250K in non-dilutive funding (grants, prizes, accelerators) to fund a 5-facility pilot. Apply broadly and aggressively — grant funding is a numbers game.

### 1.1 Grant Applications (Apply to ALL of These)

**Tier 1 — High fit, apply immediately:**

| Opportunity | Amount | Deadline | Fit |
|------------|--------|----------|-----|
| Grand Challenges — EVAH (Evidence for AI in Health) | $50K–$100K | Rolling | Perfect — AI tools for frontline health workers in sub-Saharan Africa |
| Grand Challenges Africa | $50K–$100K | Check gcafrica.org | AI for health in Africa, locally-led |
| Grand Challenges Canada — Transition to Scale | $100K–$250K | Check grandchallenges.ca | Innovations with working prototypes ready for real-world testing |
| MIT Solve — 10th Anniversary Challenge | $100K+ | May 21, 2026 | Health + technology intersection, strong for demo-ready products |
| Investing in Innovation (i3) | Grants + support | Check innovationsinafrica.com | Health startups in Africa specifically |

**Tier 2 — Strong fit, apply when ready:**

| Opportunity | Amount | Deadline | Fit |
|------------|--------|----------|-----|
| Villgro Africa accelerator | $100K–$250K + mentorship | Watch for next cohort | Health tech in Africa, catalytic seed funding |
| HealthTech Hub Africa (Kigali) | Acceleration + network | Rolling | Pan-African health tech, co-working and community |
| Bill & Melinda Gates Foundation — Grand Challenges | $100K (exploration) | Rolling | Global health innovation, specifically immunization |
| Digital Health Impact Accelerator (DHIA) | Part of $50M program | Through Gavi/partners | Digital health in sub-Saharan Africa 2024–2026 |
| Patrick J. McGovern Foundation — AI for Good | $50K–$200K | Check pjmf.org | AI applied to social good |

**Tier 3 — Competitions and visibility:**

| Opportunity | Amount | Deadline | Fit |
|------------|--------|----------|-----|
| Hult Prize | $1M (grand prize) | Check hultprize.org | Student/early-stage social enterprise |
| MIT Solve — Global Health Challenge (next round) | $10K–$50K per prize | Opens September 2026 | Health technology access and equity |
| Africa Prize for Engineering Innovation (Royal Academy) | £25K | Annual cycle | Engineering innovation solving African challenges |
| Global Health EDCTP3 | Up to €147M total program | Check calls | EU-funded global health research and innovation |

**Grant writing tips specific to VaxAI Vision:**
- Lead with the problem (vaccine wastage costs, child mortality from preventable disease), not the technology
- Your working demo is your superpower — include screenshots, link to live demo, mention it's not a mockup
- Frame around health worker empowerment, not AI replacing humans
- Budget realistically: $50K funds about 6 months of one person + cloud infrastructure + travel to pilot sites
- Always include a monitoring & evaluation plan — funders want to know you'll measure impact

### 1.2 Accelerator Programs

Apply to 3–5 accelerators simultaneously. Even if you don't get in, the application process forces you to clarify your strategy.

**Priority accelerators:**
- **Villgro Africa** — health tech in Africa, catalytic funding, Nairobi based
- **HealthTech Hub Africa** — Kigali, Rwanda, co-working + pan-African network
- **Catalyst Fund** (BFA Global) — inclusive fintech/health tech, provides capital + deep technical assistance
- **mHealth Alliance / Digital Square** — WHO-affiliated digital health community, credibility-building
- **StartUp Health** — global health innovation network, long-term mentorship

### 1.3 In-Country Groundwork

While applications are in flight, start building in-country relationships:

- **Attend or present at**: Africa Health Exhibition, Digital Health Africa conference, in-country health tech meetups
- **Reach out to**: District health officers in your target country, NGOs running immunization programs (PATH, JSI, IntraHealth), university departments of public health
- **Visit if possible**: 2–3 health facilities to understand the actual workflow, pain points, and technology infrastructure. Nothing replaces this.
- **Identify a local champion**: An in-country co-founder, partner organization, or advisor who can navigate the health ministry and local context

### 1.4 Legal & Entity Setup

- Register the company (if not already done) — consider where: US 501(c)(3) for grant eligibility, or dual structure with a local entity in target country
- Open a business bank account that can receive grant funds
- Draft a basic data processing agreement template for facility partnerships
- Understand data protection laws in your target country (Kenya has the Data Protection Act 2019, Nigeria has NDPR, Rwanda has a Data Protection Law)

**Deliverables by end of Phase 1:**
- [ ] 5+ grant applications submitted
- [ ] 2+ accelerator applications submitted
- [ ] At least 1 funding offer secured (even if small)
- [ ] In-country partner or champion identified
- [ ] Legal entity established
- [ ] 2–3 facility visits completed (or scheduled)

---

## Phase 2: PILOT DEPLOYMENT (October 2026 – March 2027)

**Goal:** Deploy VaxAI Vision in 5 real health facilities. Collect data. Prove it works. Generate evidence that unlocks larger funding.

### 2.1 Pilot Design

Before you deploy, define what success looks like:

**Primary metrics:**
- Reduction in vaccine stockout days (compare to baseline)
- Reduction in cold chain breach response time
- Health worker satisfaction score (survey)
- Data completeness improvement (% of records captured digitally vs paper)

**Secondary metrics:**
- Forecast accuracy (predicted vs actual demand)
- Time saved on inventory counts
- Cost per facility per month to operate

**Study design:**
- Work with your academic advisor to design a before/after study or a stepped-wedge design
- Collect 1–3 months of baseline data BEFORE turning on VaxAI Vision
- This baseline is critical — without it, you can't prove impact

### 2.2 Technical Deployment (Parallel Track)

This is where the technical roadmap (ROADMAP.md Phase 1) kicks in:
- Production infrastructure on AWS (RDS, ElastiCache, monitoring)
- Offline sync and low-bandwidth mode
- Facility onboarding and user management
- Data validation and error handling
- Localization for target country languages

### 2.3 Facility Onboarding

For each facility:
1. **Week 1**: Site assessment — internet connectivity, existing systems, staff capacity, cold chain equipment
2. **Week 2**: Data migration — import historical stock records, set up facility profile
3. **Week 3**: Training — 2-day hands-on workshop with health workers, leave printed quick-reference guides
4. **Week 4+**: Supported operation — daily check-ins for first week, then weekly, then monthly

### 2.4 Evidence Collection

Start generating evidence from day one of the pilot:
- Automated platform analytics (usage, data entry frequency, alert response times)
- Monthly health worker surveys (5 questions, mobile-friendly)
- Quarterly stakeholder interviews (facility managers, district health officers)
- Photograph everything — funders and grant reviewers respond to visual evidence of real-world deployment

### 2.5 Storytelling During Pilot

Don't wait until the pilot is over to talk about it:
- Publish monthly blog posts on your website about pilot progress
- Share updates on LinkedIn and Twitter/X (the global health community is very active there)
- Present preliminary findings at any available conference or webinar
- Send quarterly updates to all grant reviewers and funders, even ones who said no — they may fund the next phase

**Deliverables by end of Phase 2:**
- [ ] 5 facilities live and using VaxAI Vision daily
- [ ] 3+ months of post-deployment data collected
- [ ] Preliminary impact metrics calculated
- [ ] Pilot report drafted (co-authored with academic partner)
- [ ] Relationships with 2 additional target countries initiated
- [ ] At least 3 public-facing content pieces about pilot published

---

## Phase 3: EVIDENCE & GROWTH FUNDING (April – September 2027)

**Goal:** Use pilot evidence to raise $500K–$2M for multi-country expansion. Transition from "promising startup" to "proven solution."

### 3.1 Publish and Present Evidence

- Co-author a peer-reviewed paper with your academic partner (target: BMJ Global Health, JMIR, or similar)
- Present at WHO Digital Health Technical Advisory Group meetings
- Submit case study to Digital Square's Global Goods Guidebook
- Apply for WHO Digital Health Atlas listing

### 3.2 Scale Funding Applications

With real evidence in hand, you now qualify for larger funding:

| Opportunity | Amount | Why now |
|------------|--------|---------|
| Gavi — Health System Strengthening | $500K–$5M | You have evidence from a Gavi-eligible country |
| Global Fund — Digital Health | Part of $15B+ cycle | Pilot evidence + DHIS2 integration = strong fit |
| USAID (if reinstated/restructured) | $500K–$2M | Development innovation with evidence |
| DFID/FCDO — UK Aid | $250K–$1M | Global health innovation, Africa focus |
| Wellcome Trust — Digital Technology | $200K–$500K | Health technology innovation |
| Impact investors (Omidyar, Acumen, Skoll) | $500K–$2M | Evidence of impact + path to sustainability |

### 3.3 Team Building

By this point, you need to hire:
1. **Full-stack engineer** (or 2) — can be remote, but ideally with LMIC context experience
2. **In-country operations lead** — manages facility relationships, training, and support
3. **Grant writer / partnerships manager** — keeps the funding pipeline flowing while you focus on product
4. **ML engineer** (part-time or contract) — improves models based on real pilot data

### 3.4 Multi-Country Expansion

- Replicate pilot in 2 additional countries using the playbook from Phase 2
- Adapt the platform for each country's health system (different DHIS2 configs, languages, vaccine schedules)
- Target 200+ facilities across 3 countries by end of Q2 2027

**Deliverables by end of Phase 3:**
- [ ] Peer-reviewed paper submitted or published
- [ ] $500K+ in additional funding secured
- [ ] 3–4 person core team hired
- [ ] 200+ facilities across 3 countries
- [ ] Measurable impact: 30%+ stockout reduction at pilot sites

---

## Phase 4: PLATFORM & SUSTAINABILITY (Q3 2027 – Q4 2027+)

**Goal:** Evolve from a grant-funded project into a sustainable platform. Build the path to 1,000+ facilities and financial independence.

### 4.1 Sustainability Model

Grants fund innovation, but sustainability requires a revenue path:

- **Government procurement**: Health ministries budget for digital health tools. Once you're integrated into the national health system, you become part of the infrastructure. Target: Government pays $20–$50/facility/month
- **Donor-funded deployments**: Gavi, Global Fund, and bilateral donors fund country-level rollouts. You become a line item in their grant to the country
- **Data services**: Anonymized, aggregated supply chain intelligence is valuable to WHO, UNICEF Supply Division, and vaccine manufacturers for demand planning
- **Technical support contracts**: Charge for integration, customization, and training when deploying in new countries

### 4.2 Long-term Vision

By end of 2028, VaxAI Vision should be:
- Deployed in 8+ LMIC countries
- Processing data from 1,000+ facilities
- Integrated into national health information systems
- Generating peer-reviewed evidence of impact
- Financially sustainable through a mix of government contracts and donor funding
- Recognized as a Digital Global Good by the WHO/Digital Square community

---

## The Critical Path

If you do nothing else, do these things in this order:

1. **This week**: Fix the CI/CD pipeline so the demo works reliably
2. **This month**: Write the one-pager and pitch deck
3. **By May 21**: Submit MIT Solve application (hard deadline)
4. **By June**: Submit 3+ grant applications (Grand Challenges EVAH, GC Africa, GC Canada)
5. **By July**: Apply to Villgro Africa and HealthTech Hub Africa accelerators
6. **By August**: Identify your in-country champion and visit 2–3 facilities
7. **By September**: Secure first funding (even $25K unlocks everything)
8. **By December**: First facility goes live with real data

Every other task is secondary to this sequence. The technology is built. The bottleneck is now funding, partnerships, and getting into facilities.

---

## What Not to Do

- **Don't build more features before deploying.** The platform is 85% production-ready. The remaining 15% will only become clear after real users touch it.
- **Don't try to boil the ocean.** Pick one country, 5 facilities, one funder. Prove it works. Then expand.
- **Don't hire before funding.** Use advisors, contractors, and open-source contributors until grant money is in the bank.
- **Don't skip the baseline.** If you deploy without collecting pre-VaxAI data, you cannot prove impact, and without proof of impact, you cannot raise growth funding.
- **Don't ignore the human side.** The technology works. The hard part is training health workers, navigating ministry politics, and maintaining relationships with facility staff. Budget 50% of your time for this.

---

*This roadmap will evolve. Review it monthly. Update it quarterly. The most important thing is to start moving — apply for that first grant this week.*
