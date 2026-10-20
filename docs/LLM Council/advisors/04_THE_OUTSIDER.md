# Advisor 4: The Outsider

> **Council Lens**: Fresh eyes, zero domain curse of knowledge, user experience reality  
> **Topic**: What Does a Real Human Experience When Using EMS?

---

## Analysis

I don't know the intricacies of Indian tax laws or Fastify plugin architecture. I am just a person trying to log into an HR portal, see if I got paid, and request next Tuesday off.

Here is what happens when a normal person interacts with your software today:

1. **The Ghost Door**:
   I go to `yourdomain.com/dashboard` without logging in. Instead of instantly bouncing me to `/login`, the page sits there, downloads 17 JavaScript script files over my cell connection, flickers a broken dashboard layout for half a second, and then rudely jerks me over to the login page. It feels broken and unpolished before I even type my password.
2. **The "Reason" Trap**:
   I type: *"Dentist apt"* (11 characters) in the leave reason box. It submits. Next time I type *"Headache"* (8 characters). The frontend form says "looks good" (minimum 5 chars). I click Submit. A red backend toast pops up shouting: `body/reason must NOT have fewer than 10 characters`. Why is the machine arguing with itself? If you need 10 characters, tell me on the screen!
3. **The Disappearing Calculation**:
   I pick my leave dates on the calendar. I expect to see "3 days deducted from Annual Leave balance." Instead, the preview is blank or shows an error because the frontend is calling `GET` and the server only listens to `POST`.
4. **Cognitive Overload**:
   I open the sidebar and see 18 different navigation links: Employees, Departments, Leave, Attendance, Regularization, Payroll, Payslips, Documents, Reports, Audit Logs, Settings, Roles, Timesheets... Half of them lead to empty tables or placeholder screens. 

### Outsider Verdict:
Your developers are so deep in the database schema that they don't see how jagged the edges are for a normal user. 
Hide every sidebar link that isn't 100% finished. Synchronize your form validations so the UI and backend agree. Put a bouncer at the door so unauthenticated users can't peek into the dashboard. Make the product feel smooth, polite, and cohesive before you worry about SAP-level features.
