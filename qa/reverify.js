const BASE='https://api.safremanasik.com/api', T1='c1e10c47-79fe-4efd-a68e-67a2b70c2698', T2='c20a753c-4425-4cf3-a208-1d0dddd039be', S=Date.now();
const login=async(e,p)=>{const r=await fetch(`${BASE}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:e,password:p})});return (await r.json());};
const imp=async(t,tid)=>{const r=await fetch(`${BASE}/super-admin/tenants/${tid}/impersonate`,{method:'POST',headers:{Authorization:`Bearer ${t}`}});return (await r.json()).token;};
const cli=(tok)=>async(m,p,b)=>{const r=await fetch(`${BASE}${p}`,{method:m,headers:{'Content-Type':'application/json',...(tok&&{Authorization:`Bearer ${tok}`})},body:b?JSON.stringify(b):undefined});const t=await r.text();let j;try{j=JSON.parse(t)}catch{j=t}return{status:r.status,json:j,text:t};};
(async()=>{
 const sa=await login('superadmin@safremanasik.com','Welcome@1234'); const SA=cli(sa.token);
 const tl=await SA('GET','/super-admin/tenants');
 console.log('#1 tenants shape:', Array.isArray(tl.json)?'array':typeof tl.json, '— keys:', Array.isArray(tl.json)?`len ${tl.json.length}`:Object.keys(tl.json||{}));
 const t1=await imp(sa.token,T1); const A=cli(t1);
 // #3 hotel with correct field
 const h=await A('POST','/hotels',{name:`RV Hotel ${S}`,city:'MAKKAH',stars:5,address:'Makkah',distanceToHaramMeters:200,pricePerNight:600});
 console.log('#3 hotel create (correct field):', h.status, h.status===201?'✅':JSON.stringify(h.json).slice(0,100));
 // #4 passenger with dateOfBirth — need a booking
 const cust=await A('GET','/users/customers'); const cid=(Array.isArray(cust.json)?cust.json:cust.json.data||[])[0]?.id;
 const bk=await A('POST','/bookings',{customerId:cid,travelDateFrom:'2026-09-01T00:00:00.000Z',travelDateTo:'2026-09-05T00:00:00.000Z',totalPax:1,totalAmount:1000});
 const pax=await A('POST',`/bookings/${bk.json.id}/passengers`,{passengers:[{fullName:'RV Pax',passportNo:'RV12345',nationality:'PK',dateOfBirth:'1990-01-01T00:00:00.000Z',gender:'MALE',isPrimary:true}]});
 console.log('#4 passenger w/ dateOfBirth:', pax.status, pax.status===200?'✅':JSON.stringify(pax.json).slice(0,100));
 // #8 role assign via correct endpoint + RBAC enforcement
 const role=await A('POST','/rbac/roles',{name:`RV Bonly ${S}`,permissions:['bookings:view','bookings:create']});
 const email=`rv.staff.${S}@example.com`;
 const staff=await A('POST','/users',{name:'RV Staff',email,role:'AGENT',password:'Staff@1234',phone:'966500000950'});
 const assign=await A('PUT',`/rbac/users/${staff.json.id}/role`,{customRoleId:role.json.id});
 console.log('#8 role assign via /rbac/users/:id/role:', assign.status, assign.status===200?'✅':JSON.stringify(assign.json).slice(0,100));
 const sl=await login(email,'Staff@1234'); const SS=cli(sl.token);
 const crm=await SS('GET','/crm/leads'); console.log('#9 bookings-only staff GET /crm/leads:', crm.status, crm.status===403?'✅ blocked':'❌ NOT blocked');
 const meS=await SS('GET','/auth/me'); console.log('#10 staff perms exclude crm:', !(meS.json.permissions||[]).includes('crm_leads:view')?'✅':'❌ has crm');
 // #11 T2 impersonation + crm
 const t2=await imp(sa.token,T2); const B=cli(t2);
 const t2c=await B('GET','/crm/leads'); console.log('#11 T2 /crm/leads status:', t2c.status, t2c.status===200?'✅ (CRM on)': t2c.status===403?'⚠️ CRM off on plan (expected 403, isolated)':'status '+t2c.status);
 const t2cust=await B('GET','/customers'); console.log('   T2 /customers status:', t2cust.status);
})();
