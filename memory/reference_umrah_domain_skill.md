---
name: umrah-domain-skill
description: Custom user-level skill installed for Umrah/Hajj domain knowledge — invoke when working on Safre Manasik or any Saudi pilgrimage software
metadata:
  type: reference
---

Custom skill `umrah-domain` is installed at `C:\Users\fub7209\.claude\skills\umrah-domain\`.

**Contents:**
- SKILL.md — Core rules: passport validity, hotel city enum, currency/VAT formats, Mahram logic, terminology
- references/hotels.md — Distance buckets, common chains, amenities pilgrims care about
- references/visa.md — Umrah/Hajj/Tourist visa types, eligibility, Nusuk platform
- references/passenger.md — Required fields, age buckets, Mahram relations, validation rules
- references/packages.md — Standard package shapes (7-night default), pricing tiers, inclusions
- references/compliance.md — Saudi CR/VAT formats, ZATCA e-invoicing, data residency, MADA payments
- references/seasonality.md — Hijri calendar, Ramadan/Hajj multipliers, blackout periods
- references/transport.md — JED/MED airport routes, vehicle types, driver requirements

**Why:** Built during the SaaS roadmap project to capture domain knowledge that would otherwise need to be re-derived every session.

**How to apply:** The skill triggers automatically when conversation mentions Umrah, Hajj, Makkah, Madinah, Haram, Mutawwif, Saudi visas, or Saudi pricing. It does not need to be invoked manually.

Related: [[safre-manasik]]
