-- Seed the 10 canonical legal documents (version 1, current) sourced verbatim from
-- the product owner's supplied legal text. Auto-filled placeholder header fields and
-- signature-line footer are stripped from vehicle_delivery_acknowledgement's body since
-- those are rendered dynamically by the app at delivery time from live job data.

insert into legal_documents (slug, version, title, body, audience, is_current, effective_date)
values (
  'driver_contractor_agreement',
  1,
  'Driver Independent Contractor Services Agreement',
  'This Driver Independent Contractor Services Agreement (“Agreement”) is between Drivflo Inc. (“Drivflo”) and the individual signing below (“Driver”).

By electronically signing, the Driver confirms that the Driver has read, understood and intends to be legally bound by this Agreement.

1. Services and Assignment Model
Drivflo operates a technology-enabled transportation, vehicle-relocation, courier, document, delivery and logistics platform. Eligible Drivers may be offered individual assignments (“Assignments”).

Assignments may include dealer-to-dealer vehicle relocation, dealership-to-customer delivery, customer-to-dealership vehicle movement, customer trade transportation, courier/package delivery, document delivery and signature collection, keys/material delivery, and other approved logistics services.

2. Independent, Contract-Based and Non-Exclusive Relationship
Subject to any statutory classification or rights that applicable law determines cannot be excluded, the parties intend the relationship to be contract-based and independent.

The Driver:
performs services on an Assignment-by-Assignment basis;
is not guaranteed hours, minimum Assignments or minimum income;
chooses when to make themselves available;
may accept or decline offered Assignments before acceptance;
may work for other employers, businesses, dealerships, courier companies, transportation companies, rideshare/delivery platforms, competitors or their own customers;
is not required to work exclusively for Drivflo;
may operate another business or employment relationship.

Outside work must not interfere with an Assignment already accepted or involve misuse of Drivflo Confidential Information.

3. No Authority to Bind Drivflo
Unless expressly authorized in writing, the Driver may not bind Drivflo, modify a dealer or customer contract, promise a refund or credit, authorize repairs, negotiate vehicle sales or financing, provide legal/financial/insurance advice, settle claims, or admit liability on behalf of Drivflo.

4. Driver Responsibility for Conduct, Judgment and Discretion
The Driver is personally responsible for the Driver’s own conduct, driving, judgment, discretion, decisions and interactions with Dealers, customers, passengers and third parties.

To the maximum extent permitted by law, Drivflo does not assume responsibility merely because it coordinated an Assignment for the Driver’s independent, unauthorized, negligent, reckless, fraudulent, criminal, impaired, abusive, discriminatory or otherwise improper acts or omissions.

5. Driver Eligibility and Ongoing Documentation
The Driver must continuously maintain all qualifications required for the Assignments accepted.

Drivflo may require current or updated:
valid driver’s licence of the appropriate class;
driver’s abstract;
criminal background check;
vulnerable-sector screening where legally permitted and reasonably required for work involving children or vulnerable adults;
proof of right to work;
proof of appropriate insurance;
WorkSafeBC registration, Personal Coverage, occupational accident coverage or comparable workplace-injury coverage appropriate to the Driver’s legal status and where applicable;
limited fitness-to-drive or fitness-for-duty declaration or medical clearance where reasonably required for safety or legal compliance;
other permits, certifications or endorsements required for an Assignment category.

The Driver must promptly disclose licence suspension, driving prohibition, loss of required insurance or another material change affecting legal eligibility or safe performance.

Drivflo will not require a complete private medical history merely because a person is a Driver.

6. Assignment Offers
Where practicable, an Assignment offer may display pickup, destination, vehicle/item, anticipated timing, compensation, distance, special instructions and relevant expense information.

Declining an offered Assignment before acceptance, by itself, is not misconduct.

7. Accepted Assignments
Once accepted, the Driver must make reasonable efforts to complete the Assignment safely, lawfully and professionally.

The Driver must not transfer or subcontract an Assignment, allow another person to drive an Assignment vehicle, or abandon an Assignment without reasonable cause and prompt notice to Drivflo.

8. Compensation
Driver compensation is governed by the amount or method displayed or communicated for the Assignment, applicable Drivflo policy and applicable law.

Nothing in this Agreement permits Drivflo to pay less than any amount required by applicable legislation.

9. Driver Personal Vehicle
If the Driver uses a personal vehicle in connection with Drivflo work, the Driver must maintain that vehicle at the Driver’s own expense in:
fit, safe, roadworthy and proper working condition;
lawful registration status;
insurance appropriate for its actual use;
condition suitable for the intended Assignment.

The Driver is responsible, to the maximum extent permitted by law, for the Driver’s personal-vehicle:
maintenance;
repairs;
tires;
brakes;
servicing;
fluids;
depreciation;
wear and tear;
deductibles;
mechanical failure;
ordinary damage;
registration;
insurance;
financing;
tickets, fines, parking penalties and impound costs caused by the Driver or personal vehicle.

Drivflo does not assume responsibility for the maintenance, repair, depreciation, mechanical condition or ordinary damage to a Driver’s personal vehicle except where Drivflo expressly agrees otherwise or applicable law requires otherwise.

10. Tickets, Fines and Violations
The Driver is personally responsible for traffic tickets, parking tickets, fines, penalties and violations caused by the Driver’s own driving, parking or conduct, subject to applicable law.

11. Vehicle Inspection
Before moving an Assignment vehicle, the Driver must complete required vehicle identity and visible-condition documentation.

The standard photographic sequence may include:
front;
driver-front corner;
driver side;
driver-rear corner;
rear;
passenger-rear corner;
passenger side;
passenger-front corner;
close-ups of visible damage.

The Driver must also record VIN, odometer, fuel/charge, warning lights, keys, accessories and other information when required by the app or Assignment.

12. Unsafe or Defective Vehicles
The Driver must not operate a vehicle the Driver reasonably believes is unsafe or unlawful to operate.

The Driver must promptly report known or observed serious issues including brake, steering, tire, overheating, fluid leak, structural or material warning conditions.

13. Repairs — No Driver Authority
The Driver shall not approve, authorize, order or commit Drivflo, a Dealer, a customer or vehicle owner to any emergency or non-emergency repair, diagnostic service, part, tire, battery or mechanical work without prior approval from Drivflo.

Emergency Towing Exception
If an Assignment vehicle becomes disabled and prior approval cannot reasonably be obtained before immediate movement is necessary for safety, the Driver may authorize only a tow to the nearest reasonably appropriate mechanical repair facility or safe location.

This emergency exception does not authorize repairs.

The Driver must contact Drivflo as soon as the Driver is able and it is safe to do so.

14. Expenses
The Driver may incur only:
expenses included in the Assignment;
expenses approved by Drivflo;
expenses expressly authorized by Drivflo policy;
the emergency towing exception above.

Receipts or other reasonable proof may be required.

Unapproved personal expenses are the Driver’s responsibility unless applicable law requires payment.

15. Wait and Idle Time
The Driver must accurately record waiting and idle time through Drivflo-approved systems.

“Wait Time” or “Idle Time” includes additional Assignment time in which the Driver is reasonably available and ready to proceed but cannot continue because of Dealer, customer, vehicle, pickup, delivery or Assignment circumstances outside the Driver’s control.

Examples may include:
vehicle not ready;
missing keys;
missing documents;
customer/recipient unavailable;
vehicle cannot be released;
wrong pickup/delivery information;
Dealer-requested changes;
mechanical breakdown or roadworthiness issue;
ferry or other Assignment interruption where chargeable under the applicable rate terms.

The Dealer may be billed for additional Driver time under the Dealer Agreement and Fee, Waiting & Cancellation Policy.

The Driver must never falsify arrival, departure, wait or idle records.

16. Prohibited Conduct
The Driver must not:
perform while impaired;
use alcohol, cannabis or illegal drugs during an Assignment;
smoke/vape in an Assignment vehicle;
drive recklessly;
use a handheld device contrary to law;
carry unauthorized passengers;
permit another person to drive;
use an Assignment vehicle for personal purposes;
make unauthorized stops;
use or remove customer property;
duplicate keys;
falsify photos, timestamps, receipts, mileage or records;
steal, commit fraud or engage in dishonesty;
harass, threaten or discriminate;
post customer, Dealer, vehicle or Assignment information publicly without authority.

17. Drug and Alcohol Policy
The Driver agrees to the Drivflo Drug & Alcohol Policy and must never perform an Assignment while impaired.

18. Accidents and Emergencies
The Driver must:
stop safely;
contact emergency services where appropriate or legally required;
comply with legal reporting obligations;
notify Drivflo as soon as safely possible;
preserve relevant evidence;
reasonably photograph the scene where safe;
cooperate with the vehicle owner and insurer;
not admit liability or promise payment on behalf of Drivflo, Dealer or insurer.

19. Confidentiality and Binding Non-Disclosure Agreement
This section is intended to constitute a binding non-disclosure agreement (“NDA”) and is a material condition of access to Drivflo Assignments.

“Confidential Information” includes non-public:
Dealer and customer names, contacts and lists;
Driver lists and information;
pricing, rate cards, fees, margins and compensation structures;
business plans and forecasts;
routes, logistics and operating methods;
internal procedures and policies;
software, platform workflows, code, designs and technology;
sales, marketing and financial information;
contracts and commercial terms;
account information;
access instructions;
any information reasonably understood to be confidential.

The Driver shall:
use Confidential Information only as necessary to perform authorized Drivflo work;
not disclose it to unauthorized persons;
not copy, sell, publish, exploit or retain it for unrelated purposes;
take reasonable steps to protect it;
return or destroy it when reasonably requested, subject to lawful record-retention requirements.

This NDA survives termination.

Nothing prohibits disclosure required by law, lawful reporting to a regulator, law enforcement, legal counsel, or exercise of a legally protected right.

20. Privacy
The Driver must comply with the Drivflo Privacy Policy and protect customer/Dealer personal information.

21. Platform Records and Location
Drivflo may retain Assignment-related GPS/location, timestamps, photographs, signatures, communications, inspection records, proof-of-delivery records, incident reports and payment information in accordance with applicable privacy law.

22. 90-Day Initial Qualification Period
The first ninety (90) days after approval are the Driver’s Initial Qualification Period.

Subject to applicable statutory rights, either party may end the relationship during this period without cause.

23. Suspension and Termination
Subject to applicable law, Drivflo may restrict, suspend or terminate access for legitimate reasons including safety, fraud, theft, impairment, expired credentials, serious misconduct, repeated abandonment of accepted Assignments, falsification, unauthorized vehicle use, privacy/confidentiality breach or material breach.

Drivflo will provide any mandatory notice, reason, review or reinstatement process required by law.

24. Driver Indemnity
To the maximum extent permitted by law, the Driver shall indemnify, defend and hold harmless the Drivflo Protected Parties from third-party claims, damages, losses, penalties, liabilities and reasonable legal costs to the extent arising from:
the Driver’s negligent, reckless, intentional or unlawful act or omission;
fraud, theft or dishonesty;
unauthorized vehicle use;
breach of this Agreement;
breach of confidentiality/privacy;
unauthorized representations;
traffic violations for which the Driver is responsible;
infringement of third-party rights.

The Driver is not required to indemnify a Protected Party to the extent applicable law prohibits shifting that liability.

25. Drivflo Protected Parties
“Drivflo Protected Parties” means Drivflo Inc. and its present and future parents, subsidiaries, affiliates, shareholders, beneficial owners, directors, officers, employees, representatives, agents, contractors, successors, assigns and insurers and, where a Protected Party is a natural person and applicable, that person’s estate, heirs, executors, administrators and personal representatives.

26. Release and Limitation of Drivflo Liability
TO THE MAXIMUM EXTENT PERMITTED BY LAW, the Driver releases the Drivflo Protected Parties from claims arising from risks inherent in independently performing Assignments and from matters outside Drivflo’s reasonable control, including acts of Dealers/customers/other road users, pre-existing vehicle defects, hidden mechanical conditions, weather, road conditions, traffic, government action and incorrect information supplied by others.

Nothing excludes liability or statutory rights that applicable law does not permit to be excluded.

27. No Consequential Damages
To the maximum extent permitted by law, Drivflo will not be liable for indirect, special, incidental, punitive or consequential damages including lost profit, lost business opportunity or loss of goodwill, except where prohibited by law.

28. Insurance and Workplace-Injury Coverage
Nothing in this Agreement guarantees that a particular loss is insured.

The Driver must maintain insurance and workplace-injury/occupational coverage required by law and by the Assignment category or Drivflo qualification requirements applicable to the Driver.

29. No Waiver of Non-Waivable Rights
Nothing in this Agreement waives employment standards, workers’ compensation, occupational health and safety, privacy, insurance or other legal rights that cannot lawfully be waived.

30. Incorporated Policies
This Agreement incorporates, as applicable:
Drivflo Drug & Alcohol Policy;
Driver Standards & Code of Conduct;
Vehicle Inspection & Damage Policy;
Driver Expense & Reimbursement Policy;
Drivflo Privacy Policy;
Drivflo Platform Terms of Service.

31. Severability
If any provision is unenforceable, it will be limited or severed to the minimum extent necessary and the remaining Agreement remains effective.

32. Survival
Confidentiality, privacy, indemnity, release, limitation of liability, payment and other provisions intended by their nature to survive will survive termination.

33. Governing Law
This Agreement is governed by the laws of British Columbia and applicable federal laws of Canada, subject to any statutory jurisdiction that cannot lawfully be excluded.

34. Electronic Signature
The Driver consents to electronic contracting and agrees that the Driver’s electronic signature, acceptance controls and related audit record are intended to evidence legal acceptance.

Required Driver Acknowledgements
☐ I have read and agree to the Drivflo Drug & Alcohol Policy.
☐ I understand the 90-Day Initial Qualification Period.
☐ I understand that I may work for other companies and am not required to work exclusively for Drivflo.
☐ I understand that I may accept or decline offered Assignments before acceptance.
☐ I understand my responsibility for my personal vehicle, tickets, maintenance and lawful insurance.
☐ I understand that I may not authorize repairs and that the only emergency exception is a tow as described above.
☐ I have read and agree to the confidentiality and non-disclosure obligations.
☐ I have read and agree to this Agreement.

Driver Name: ____________________
Electronic Signature: ____________________
Date/Time: ____________________
Agreement Version: ____________________',
  'driver',
  true,
  '2026-08-19'
);

insert into legal_documents (slug, version, title, body, audience, is_current, effective_date)
values (
  'dealer_master_services_agreement',
  1,
  'Dealer Master Services Agreement',
  'This Dealer Master Services Agreement (“Agreement”) is between Drivflo Inc. (“Drivflo”) and the dealership or business identified in the Dealer application (“Dealer”).

The signer represents that they are authorized to bind the Dealer.

1. Services
Drivflo provides technology-enabled transportation, vehicle relocation, courier, document, delivery, logistics and other approved services.

Each accepted service request is an “Assignment.”

2. Master Agreement
This Agreement governs all Assignments placed through the Dealer’s Drivflo account unless otherwise agreed in writing.

3. Authorized Users
The Dealer is responsible for maintaining authorized account users and for requests submitted through credentials it knowingly provides or authorizes, subject to applicable law.

4. Drivflo’s Role and Independent Driver Conduct
Drivflo operates a platform and logistics-coordination service and may arrange for eligible Drivers to perform Assignments.

TO THE MAXIMUM EXTENT PERMITTED BY LAW, Drivflo does not assume responsibility merely because it coordinated an Assignment for a Driver’s independent, unauthorized, criminal, fraudulent, reckless, impaired or otherwise improper conduct.

Nothing excludes liability that applicable law does not permit Drivflo to exclude.

5. Dealer Authority Over Vehicle
By submitting a vehicle Assignment, the Dealer represents that it owns the vehicle or has lawful possession and authority to request its transportation.

The Dealer is responsible for claims arising from lack of such authority and shall indemnify the Drivflo Protected Parties as provided below.

6. Dealer Responsibility for Roadworthiness — Delivery Vehicles and Trades
The Dealer is responsible for ensuring that every vehicle tendered for a Drivflo Assignment, including a delivery vehicle, Dealer trade, customer trade-in or other vehicle being picked up or returned, is roadworthy, mechanically fit and lawful to operate before pickup.

The Dealer must disclose known material conditions affecting safe or reliable operation, including:
brake issues;
steering issues;
unsafe tires;
serious fluid leaks;
overheating;
significant battery/charging issues;
warning conditions;
structural or collision damage affecting safe operation;
material glass/light defects;
known mechanical issues;
unusual operating requirements.

Drivflo or a Driver may refuse or discontinue movement of a vehicle reasonably believed to be unsafe or unlawful.

7. Dealer Financial Responsibility for Vehicle Breakdown or Unroadworthiness
If an Assignment is interrupted, delayed, cancelled or otherwise affected because a Dealer-supplied delivery vehicle, Dealer trade, customer trade-in or other vehicle tendered by the Dealer is unroadworthy, mechanically defective, disabled, unsafe or affected by a pre-existing condition or undisclosed defect, the Dealer shall be responsible for all reasonable additional costs and expenses arising from that condition, including as applicable:
tow charges;
roadside recovery;
storage;
approved diagnostic charges;
approved mechanic repairs;
parts or service expressly approved by Drivflo;
Driver waiting/idle time;
additional Driver compensation;
return transportation;
replacement transportation;
taxis or rideshare;
rental vehicles;
airfare/flights;
ferries;
tolls;
parking;
accommodation/hotels;
rescheduling or redelivery;
third-party cancellation fees;
other reasonable expenses arising from the breakdown, recovery or interrupted Assignment.

Dealer responsibility applies whether the affected vehicle is the vehicle being delivered or a trade-in being collected in connection with the Assignment, except to the extent a final determination establishes the expense was caused by a matter for which applicable law places responsibility elsewhere and does not permit contractual allocation.

8. Repairs and Towing
Drivers are not authorized to approve repairs.

No emergency or non-emergency repairs to a Dealer/customer vehicle may be authorized without prior Drivflo approval.

If a vehicle is disabled and prior approval cannot reasonably be obtained before immediate movement is necessary for safety, a Driver may authorize only a tow to the nearest reasonably appropriate mechanical repair facility or safe location.

Where the tow results from roadworthiness, pre-existing mechanical condition or an undisclosed defect of a vehicle tendered by the Dealer, the Dealer is responsible for the tow and related expenses.

9. Registration, Plates, Permits and Insurance
Unless expressly assumed by Drivflo in writing, the Dealer is responsible for ensuring required registration, plates, permits, operating authority, ownership authorization and insurance information required to lawfully perform the requested Assignment.

Nothing in this Agreement guarantees any particular insurance coverage.

10. Assignment Information
The Dealer is responsible for materially accurate:
year/make/model;
VIN;
pickup/delivery addresses;
customer contact;
keys;
operating instructions;
vehicle condition information;
special requirements.

11. Vehicle Contents
Unless specifically disclosed and accepted as part of the Assignment, Drivflo is not responsible for undisclosed cash, valuables or personal property left in a vehicle.

12. Pickup Readiness
The Dealer must make the vehicle/item reasonably available at the agreed location/time with keys, documents and required authority.

13. WAIT TIME / IDLE TIME — DEALER RESPONSIBILITY
Any additional Driver time reasonably incurred because the Driver is unable to proceed with an Assignment for reasons attributable to the Dealer, the Dealer’s customer/recipient, the vehicle, the pickup/delivery location, or Dealer-requested changes will be billed to the Dealer.

Billable wait or idle time may include time caused by:
vehicle not ready for release;
missing keys;
missing registration/permit/documentation;
Dealer employee unavailable;
customer/recipient unavailable;
incorrect or incomplete pickup/delivery instructions;
additional paperwork not ready;
Dealer-requested changes after dispatch;
vehicle requiring jump-start, recovery, assessment or other delay;
breakdown, unroadworthiness or mechanical condition of the delivery vehicle or trade;
waiting for a tow, authorized mechanic response or Dealer direction;
additional delivery/pickup stop;
other delay not caused by the Driver or Drivflo.

The complimentary wait period, if any, and applicable wait/idle rate will be the amount displayed in the Assignment, Dealer rate card, Dealer account or other written pricing.

Drivflo may use GPS, timestamps, geofencing, Driver check-in/out, communications, photographs and other Assignment records to substantiate wait or idle time.

Wait/idle fees are in addition to the base Assignment charge and other expenses.

The Dealer remains responsible for properly chargeable wait/idle time even if the underlying Assignment is later cancelled.

14. Pricing and Additional Charges
The Dealer will pay:
base Assignment charges;
applicable taxes;
authorized expenses;
ferries;
tolls;
parking;
fuel/charging where applicable;
billable wait/idle time;
cancellation charges;
failed-pickup charges;
additional stops;
return transportation;
redelivery/recovery;
towing;
approved mechanical expenses;
other charges validly arising under the Assignment or Fee Policy.

15. Cancellations — Credit Less Incurred Expenses
Unless otherwise agreed in writing or required by law, a cancelled Assignment will result in an account credit rather than a cash refund, subject to deduction of:
non-refundable costs;
expenses already incurred;
expenses reasonably committed before cancellation;
applicable cancellation charges.

Deductible expenses may include:
flights;
ferries;
hotels;
tolls;
parking;
rental vehicles;
taxis/rideshare;
Driver positioning;
Driver return transportation;
third-party cancellation fees;
other reasonable costs already incurred or committed.

Any properly billable wait/idle time incurred before cancellation remains payable.

If possession of a vehicle/item has already been taken, Drivflo may treat cancellation as a return, redirection or new Assignment and charge the reasonable resulting costs.

16. Payment
The Dealer authorizes Drivflo to invoice or charge the approved payment method for amounts validly due.

17. Vehicle Condition Report
Drivflo may require pickup/delivery condition photographs, VIN, odometer and other records.

A condition report is not a mechanical inspection, safety certification or warranty.

18. Customer Information
The Dealer represents that it has lawful authority to provide customer information reasonably required to complete an Assignment.

Use of personal information is governed by the Drivflo Privacy Policy and applicable law.

19. Dealer Sales Obligations
Drivflo is not responsible for Dealer representations concerning:
purchase price;
financing;
warranties;
promised repairs;
accessories;
vehicle history;
trade value;
Due Bills/We Owes;
other terms of a vehicle sale.

A Driver is not authorized to alter those commitments.

20. Accidents and Damage Claims
Drivflo may investigate alleged damage using pickup/delivery photos, GPS, timestamps, statements, repair estimates and insurer information.

Investigation is not an admission of liability.

Where reasonably practicable, non-emergency repairs alleged to be Assignment-related should not be completed until Drivflo or an applicable insurer has had a reasonable opportunity to document the claimed damage.

21. Dealer Indemnity
To the maximum extent permitted by law, the Dealer shall indemnify, defend and hold harmless the Drivflo Protected Parties from third-party claims, losses, damages, penalties, liabilities and reasonable legal costs to the extent arising from:
Dealer breach;
Dealer negligence or unlawful conduct;
inaccurate Assignment information;
lack of authority over a vehicle;
pre-existing or undisclosed vehicle defects;
roadworthiness/mechanical condition of vehicles tendered by Dealer;
improper registration/plate/permit arrangements supplied by Dealer;
Dealer customer claims arising from Dealer sales obligations;
acts/omissions of Dealer employees/agents;
undisclosed dangerous property or valuables.

22. Dealer Confidentiality / Non-Disclosure Agreement
This section constitutes a binding NDA.

The Dealer must not disclose or misuse Drivflo’s non-public:
pricing and rate structures;
margins;
Driver compensation information;
Driver lists and contact information;
customer lists;
platform methods/workflows;
software and technical information;
internal procedures;
business plans and financial information;
commercial terms.

Information may be used only for the Dealer’s authorized relationship with Drivflo.

This obligation survives termination.

Nothing prevents disclosure required by law or to authorized professional advisers under appropriate confidentiality.

23. Drivflo Protected Parties
“Drivflo Protected Parties” means Drivflo Inc. and its present and future parents, subsidiaries, affiliates, shareholders, beneficial owners, directors, officers, employees, representatives, agents, contractors, successors, assigns and insurers and, where a Protected Party is a natural person and applicable, that person’s estate, heirs, executors, administrators and personal representatives.

24. Release
TO THE MAXIMUM EXTENT PERMITTED BY LAW, the Dealer releases the Drivflo Protected Parties from claims arising from ordinary/inherent transportation risks and matters outside Drivflo’s reasonable control, including acts of unrelated third parties, weather, traffic, road conditions, pre-existing defects, hidden mechanical conditions and inaccurate information supplied by others.

Nothing excludes liability that applicable law does not permit to be excluded.

25. Limitation of Liability
To the maximum extent permitted by law, Drivflo is not liable for indirect, special, incidental, punitive or consequential damages, including lost profit, lost sale, business interruption, loss of goodwill or lost opportunity.

Except for liability that applicable law prohibits Drivflo from limiting, Drivflo’s aggregate contractual liability arising from an individual Assignment will not exceed the greater of:
amounts actually paid to Drivflo for that Assignment; and
amounts payable under applicable insurance maintained specifically in respect of that loss,
subject to policy terms, limits, deductibles and coverage determinations.

26. Force Majeure
Drivflo is not liable for delay/failure caused by events outside its reasonable control including severe weather, highway closures, natural disaster, government action, emergencies or widespread telecommunications failures.

27. Account Suspension and Termination
Drivflo may suspend or terminate for legitimate reasons including non-payment, fraud, unsafe requests, abuse, misuse or material breach, subject to applicable law.

28. Governing Law
This Agreement is governed by the laws of British Columbia and applicable federal laws of Canada, subject to statutory jurisdiction that cannot lawfully be excluded.

29. Electronic Signature
The Dealer consents to electronic contracting and agrees that the authorized representative’s electronic signature and associated audit records are intended to evidence legal acceptance.

Dealer Acknowledgements
☐ I am authorized to bind the Dealer.
☐ I understand the Dealer is responsible for roadworthiness of delivery vehicles and trades.
☐ I understand breakdown-related expenses may be charged to the Dealer as described above.
☐ I understand additional Driver wait/idle time is billable to the Dealer.
☐ I understand cancelled jobs are ordinarily credited less incurred/committed expenses and applicable charges.
☐ I agree to the Dealer confidentiality/NDA obligations.
☐ I have read and agree to this Agreement.

Dealer Legal Name: ____________________
Authorized Representative: ____________________
Title: ____________________
Electronic Signature: ____________________
Date/Time: ____________________
Agreement Version: ____________________',
  'dealer',
  true,
  '2026-08-19'
);

insert into legal_documents (slug, version, title, body, audience, is_current, effective_date)
values (
  'vehicle_delivery_acknowledgement',
  1,
  'Vehicle Delivery Acknowledgement, Release & Acceptance',
  '1. Receipt and Inspection Opportunity
I acknowledge physical receipt of the vehicle identified above and that I have been given a reasonable opportunity to inspect its reasonably visible exterior, interior, glass, wheels/tires, lights, accessories, odometer, keys and included items.

2. Vehicle Identification
I acknowledge that the physical vehicle delivered matches the VIN and delivery information shown above.

Any issue concerning what vehicle I agreed to purchase, promised equipment, financing, warranties or Dealer representations remains governed by my agreement with the selling Dealer and applicable law.

3. Condition Report
I acknowledge that pickup and delivery condition photographs and/or a Vehicle Condition Report may form part of the delivery record.

The condition report is not a mechanical inspection, safety certification or warranty.

4. Physical Delivery
My signature confirms receipt and physical delivery. It does not determine legal title where title is governed by the purchase agreement, registration or applicable law.

5. Dealer Obligations
Drivflo is a transportation/delivery provider and is not responsible for Dealer promises concerning purchase price, financing, interest, warranty, vehicle history, mechanical condition, promised repairs, accessories, Due Bills/We Owes, trade arrangements or other terms of the sale unless Drivflo separately assumes an obligation in writing.

6. Driver Authority
A Drivflo Driver is not authorized to modify my purchase agreement, financing, warranty, repair promise, refund or credit, or provide legal/financial advice merely by performing delivery.

7. Driver Conduct / Drivflo Liability
Drivers are personally responsible for their own conduct and decisions.

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, Drivflo does not assume responsibility merely because it coordinated the delivery for unauthorized, criminal, fraudulent, reckless or other independent misconduct by a Driver.

Nothing waives liability or rights that applicable law does not permit to be waived.

8. Post-Delivery Possession
After physical handover, I am responsible for safeguarding the vehicle and keys and for subsequent possession/use, subject to my rights under the purchase agreement, insurance and applicable law.

9. Customer/Recipient Indemnity
To the maximum extent permitted by law, I agree to indemnify the Drivflo Protected Parties from third-party claims and reasonable legal costs to the extent caused by my own unlawful/negligent conduct after delivery, materially false authority to accept the vehicle, unauthorized direction to the Driver, or misuse of another person’s property or information.

10. Drivflo Protected Parties
“Drivflo Protected Parties” means Drivflo Inc. and its present and future parents, subsidiaries, affiliates, shareholders, beneficial owners, directors, officers, employees, representatives, agents, contractors, successors, assigns and insurers and, where a Protected Party is a natural person and applicable, that person’s estate, heirs, executors, administrators and personal representatives.

11. Release
TO THE MAXIMUM EXTENT PERMITTED BY LAW, I release the Drivflo Protected Parties from claims arising solely from ordinary/inherent transportation risks outside Drivflo’s reasonable control, including ordinary traffic delay, weather, road closure, unrelated road-user conduct, hidden/pre-existing vehicle defects and materially inaccurate information supplied by others.

This release does not waive non-waivable consumer rights, legitimate delivery-damage claims, applicable insurance rights or other liability the law does not permit Drivflo to exclude.

12. Damage Reporting
Potential delivery damage should be reported as soon as reasonably practicable so Drivflo, the Dealer and insurer can investigate.

Reporting damage is not an admission that Drivflo or the Driver caused it.

13. Privacy and Electronic Records
Drivflo may retain delivery time/location, VIN/vehicle information, condition photographs, signature and related proof-of-delivery records in accordance with the Drivflo Privacy Policy and applicable law.

14. Electronic Signature
By signing, I confirm I am the intended recipient or authorized recipient, I had an opportunity to review this acknowledgement, and I intend my electronic signature to evidence acceptance.',
  'customer',
  true,
  '2026-08-19'
);

insert into legal_documents (slug, version, title, body, audience, is_current, effective_date)
values (
  'privacy_policy',
  1,
  'Privacy Policy',
  'Drivflo Inc. (“Drivflo”, “we”, “us”, “our”) is committed to handling personal information responsibly and in accordance with applicable privacy law, including British Columbia’s Personal Information Protection Act (“PIPA”) where applicable.

1. Privacy Officer
Drivflo designates a Privacy Officer responsible for privacy compliance.

Privacy Officer — Drivflo Inc.
Contact information: as published on the Drivflo website, application or account portal.

Before public launch, Drivflo will publish direct Privacy Officer contact information.

2. Information We May Collect
Drivers
contact and identity information;
driver’s licence and driving abstracts;
criminal/background screening;
vulnerable-sector clearance where legally permitted/required for approved work;
limited fitness-to-drive/fitness-for-duty information;
insurance and vehicle information;
WorkSafeBC/occupational-coverage information where applicable;
tax/payment information;
electronic signatures;
GPS/location/timestamps while administering or performing Assignments;
inspection photos, VIN, odometer, vehicle and delivery records;
complaints, incidents, safety and investigation records;
training/qualification records.

Drivflo will not require a complete private medical history merely because someone is a Driver.

Dealers/Business Users
names, titles, contact and account information;
billing/payment information;
vehicle/VIN/Assignment/customer data;
communications, claims and support records;
signatures and authorization records.

Customers/Recipients
name/contact/delivery address;
pickup/delivery instructions;
vehicle/VIN/odometer;
delivery time/location;
condition/proof-of-delivery photos;
signatures;
complaints/claims;
optional promotional photos/video only under separate consent where required.

Website/App
IP/device/browser;
login/security;
diagnostic/activity;
cookie/similar technology information.

3. Sources
Information may come from the person directly, Dealers, Drivers, customers, background providers, insurers, WorkSafeBC/authorized sources, payment providers, service providers, public authorities or other lawful sources.

4. Purposes
Drivflo may use personal information to:
create/administer accounts;
assess Driver eligibility;
offer and perform Assignments;
identify vehicles/recipients;
track active Assignments;
document pickup/delivery;
calculate compensation/fees/expenses;
process payments;
communicate/support;
investigate accidents, damage, theft, fraud or safety incidents;
administer insurance;
meet tax/accounting/transportation/employment/workplace/legal obligations;
secure the platform;
maintain records and enforce agreements;
improve Services;
conduct marketing where legally permitted and appropriately consented.

5. GPS/Location
Drivflo may collect location data reasonably necessary to confirm arrival/pickup/delivery, track active Assignment progress, calculate distance/wait time, protect people/vehicles/property, investigate incidents, provide support and prevent fraud.

Drivflo does not intend to monitor a Driver’s unrelated private activities when not performing/administering a Drivflo Assignment except for a separately disclosed lawful security purpose.

6. Photos/Video
Operational photos may document vehicle condition, VIN, odometer, keys, damage and proof of delivery.

Operational photos are not automatically authorized for marketing.

Promotional use involving an identifiable customer/recipient will be subject to separate voluntary consent where required.

7. Sensitive Driver Screening
Criminal-record, vulnerable-sector, fitness-to-drive and similar sensitive information will be restricted to authorized persons/service providers and used only for legitimate qualification, safety, legal or related purposes.

8. Consent
Drivflo obtains consent where required by law.

Consent may be express, implied or otherwise permitted depending on the circumstances, sensitivity and purpose.

Consent may be withdrawn on reasonable notice, subject to legal/contractual restrictions and permitted retention/use.

9. Disclosure
Drivflo may disclose personal information as reasonably necessary to:
Dealer requesting the Assignment;
Driver performing it;
authorized customer/recipient;
insurer/adjuster/broker;
payment/financial providers;
background-screening providers;
cloud/software/communications/mapping/security providers;
tow/repair/transport providers;
lawyers/accountants;
police, courts, regulators or authorities where lawful;
a legitimate purchaser/investor/successor in a corporate transaction subject to appropriate safeguards.

Drivflo does not sell personal information to advertisers.

10. Service Providers / Outside Canada
Service providers may store/process information outside B.C. or Canada.

Information may therefore be subject to lawful access under the laws of another jurisdiction.

Drivflo remains responsible for information under its control and uses reasonable contractual, technical and organizational safeguards.

11. Security
Reasonable safeguards may include role-based access, authentication, access controls/logging, secure transmission/encryption where appropriate, vendor controls, confidentiality obligations, restricted access to sensitive records and incident-response procedures.

No system can be guaranteed completely secure.

12. Privacy Incidents
Drivflo will investigate suspected loss, unauthorized access/use/disclosure and will notify affected individuals or authorities where required by law or reasonably appropriate.

13. Retention/Destruction
Drivflo retains information only as long as reasonably necessary for the original purpose or legitimate legal/business needs including claims, insurance, tax/accounting, safety, regulatory or limitation-period requirements.

When no longer reasonably required, Drivflo will destroy, securely dispose of, or de-identify it.

14. Access and Correction
Subject to law, individuals may request access to their personal information and correction of inaccurate information.

Drivflo may verify identity before responding.

Requests go to the Privacy Officer.

15. Complaints
Privacy complaints may be directed to the Privacy Officer.

Nothing limits an individual’s right to contact the Office of the Information and Privacy Commissioner for British Columbia or another lawful authority.

16. Children
Driver/dealer platforms are not intended for children.

Information concerning a minor will be handled only where legitimately required for an authorized Service and in accordance with law.

17. Changes
Drivflo may update this Policy on reasonable notice.

The effective date identifies the current version.',
  'all',
  true,
  '2026-08-19'
);

insert into legal_documents (slug, version, title, body, audience, is_current, effective_date)
values (
  'platform_terms_of_service',
  1,
  'Platform Terms of Service',
  'These Terms govern use of Drivflo websites, apps and portals and supplement specific signed agreements.

A more specific signed agreement governs to the extent of a direct conflict.

1. Eligibility and Authority
Users must provide materially accurate information and have legal authority to act for themselves or the business account they use.

2. Electronic Contracting
Users consent to electronic transactions, acceptance controls and signatures.

Drivflo may retain agreement version, identity, timestamp, signature/acceptance event and reasonable audit information.

3. Accounts
Users must protect credentials, use authorized accounts, report suspected unauthorized access and keep material account data current.

4. Platform Function
Drivflo facilitates transportation, vehicle relocation, courier, document, delivery and logistics Services.

Availability, matching and estimated timing are not guaranteed.

5. Assignment Information
Users must not knowingly provide false vehicle, recipient, route, authority, payment or safety information.

6. Estimates
ETA, pickup/delivery and completion times are estimates unless expressly guaranteed in writing.

7. Fees
Fees are governed by displayed Assignment pricing, Dealer rate cards, account terms and the Fee, Waiting & Cancellation Policy.

8. Cancellations
Cancellations are governed by the Fee, Waiting & Cancellation Policy and applicable signed agreements.

9. Conduct
Users must not commit fraud, threaten/harass, misuse personal/confidential information, compromise platform security, impersonate others or use Drivflo unlawfully.

10. Third-Party Services
Mapping, payments, communications, screening, cloud hosting and other providers may be subject to separate terms.

11. Privacy
Use of personal information is governed by the Drivflo Privacy Policy and law.

12. Intellectual Property
Drivflo owns or licenses its platform, branding, software, workflows, documentation and related intellectual property.

13. Confidentiality
Applicable Driver/Dealer confidentiality and NDA obligations remain binding.

14. Suspension
Drivflo may restrict access for legitimate safety, fraud, security, non-payment, expired credential, misconduct, regulatory or breach reasons, subject to applicable law.

15. Drivflo Protected Parties
“Drivflo Protected Parties” means Drivflo Inc. and its present/future parents, subsidiaries, affiliates, shareholders, beneficial owners, directors, officers, employees, representatives, agents, contractors, successors, assigns and insurers and, where a Protected Party is a natural person and applicable, that person’s estate, heirs, executors, administrators and personal representatives.

16. Disclaimer
TO THE MAXIMUM EXTENT PERMITTED BY LAW, Drivflo does not assume responsibility merely because it coordinates an Assignment for independent Driver misconduct, acts of Dealers/customers/other road users, hidden/pre-existing vehicle defects, incorrect information supplied by others, road conditions, traffic, weather, government action or third-party outages.

17. Limitation
TO THE MAXIMUM EXTENT PERMITTED BY LAW, Drivflo is not liable for indirect, special, incidental, punitive or consequential damages including lost profit, opportunity or goodwill.

18. Non-Waivable Rights
Nothing waives rights or obligations that applicable law does not permit to be waived.

19. Governing Law
British Columbia law and applicable federal Canadian law govern, subject to mandatory statutory jurisdiction.

20. Severability
Unenforceable provisions will be limited/severed to the minimum extent necessary.

21. Changes
Drivflo may update these Terms prospectively on reasonable notice.',
  'all',
  true,
  '2026-08-19'
);

insert into legal_documents (slug, version, title, body, audience, is_current, effective_date)
values (
  'fee_waiting_cancellation_policy',
  1,
  'Fee, Waiting and Cancellation Policy',
  'This Policy forms part of applicable Dealer/Driver agreements and Assignment terms.

Specific dollar amounts may vary by Dealer, Assignment, route, service and account.

Where a displayed Assignment rate or written Dealer rate card differs, the specific rate governs.

1. Base Charges
Assignment pricing may include base service, mileage/route, Driver compensation, platform/dispatch, ferry/toll estimates, special handling, after-hours, additional stops and other disclosed components.

2. Expenses
Dealer is responsible for properly chargeable Assignment expenses including where applicable:
fuel/charging;
ferries;
tolls;
parking;
towing/recovery;
authorized diagnostics/repairs;
flights;
rental vehicles;
taxis/rideshare;
accommodation;
storage;
return transportation;
additional Driver compensation;
other reasonable Assignment expenses.

3. WAIT / IDLE TIME — BILLED TO DEALER
Additional Driver time caused by Dealer, customer/recipient, vehicle, pickup/delivery readiness or Dealer-requested changes will be billed to the Dealer.

Wait/idle time begins when the Driver is reasonably available and ready to proceed but cannot proceed for a chargeable reason.

Examples:
vehicle not ready;
keys unavailable;
paperwork/documentation unavailable;
Dealer employee unavailable;
customer/recipient unavailable;
Dealer/customer requests Driver to remain on site;
wrong address/instructions;
additional paperwork/signing delay;
vehicle requires jump/recovery;
mechanical breakdown/unroadworthiness;
waiting for tow/authorized mechanic/Dealer instructions;
Dealer-requested route/stop/timing change;
other non-Driver delay.

Any complimentary wait period and the charge thereafter will be displayed in the Assignment, Dealer rate card, Dealer account or otherwise agreed in writing.

Drivflo may use GPS, geofence, timestamps, Driver check-in/out, communications, photos and other records to substantiate time.

Wait/idle charges are additional to the base Assignment price and remain payable even if the Assignment is later cancelled, where the time was properly incurred before cancellation.

4. Vehicle Roadworthiness Expenses
Dealer is responsible for roadworthiness/mechanical fitness of delivery vehicles and trades.

If a vehicle breaks down due to pre-existing condition, roadworthiness or undisclosed defect, Dealer is responsible for reasonable resulting:
tow/recovery;
storage;
approved diagnostics/repair;
Driver wait/idle time;
Driver return/recovery;
flight;
ferry;
hotel;
rental/taxi/rideshare;
parking/tolls;
other recovery/interruption costs.

5. Cancellation — Credit Less Costs
Unless otherwise agreed or required by law, cancellation results in Drivflo account credit rather than cash refund, less:
cancellation charge;
non-refundable expenses;
incurred expenses;
committed expenses.

Examples include flights, ferries, hotels, tolls, parking, rental, taxi/rideshare, Driver positioning/return and third-party cancellation fees.

6. Cancellation After Driver Acceptance/Dispatch/Arrival
Additional cancellation charges may apply at stages such as:
Driver accepted;
Driver en route;
Driver arrived;
possession taken;
Assignment underway.

Specific amount is shown in Assignment/rate card/account terms.

7. Cancellation After Possession
After Drivflo/Driver takes possession, cancellation may be treated as a return/redirection/new Assignment.

Dealer pays reasonable secure/storage/return/redirection costs.

8. Failed Pickup
Failed-pickup charges may apply if Driver arrives but cannot take possession because vehicle/item absent, keys missing, authority/documents missing, vehicle unsafe, instructions materially wrong or Dealer contact unavailable.

9. Assignment Changes
Destination, stop, vehicle, timing, route, ferry or other material changes may result in revised pricing.

10. Disputed Charges
Dealer should provide job number, amount disputed, reason and supporting evidence.

Drivflo may review GPS, timestamps, receipts, communications and Assignment records.

11. Credits
Credits:
apply to Dealer Drivflo account;
are not cash/redeemable for cash except where required by law or expressly approved;
may be used for future eligible services;
may be corrected if issued in error.

Any expiry/restriction will be disclosed when issued.

12. No Driver Authority to Waive
Drivers cannot waive, refund, reduce or alter Drivflo charges unless expressly authorized.',
  'dealer',
  true,
  '2026-08-19'
);

insert into legal_documents (slug, version, title, body, audience, is_current, effective_date)
values (
  'drug_alcohol_policy',
  1,
  'Drug and Alcohol Policy',
  '1. Zero Impairment Standard
A Driver must not accept or perform an Assignment while impaired and must not operate a vehicle where alcohol, cannabis, illegal drugs, medication or any substance makes safe performance unreasonable.

2. Prohibited
A Driver must not:
consume alcohol/cannabis/illegal drugs during an Assignment;
possess illegal drugs in Dealer/customer/Assignment vehicles;
misuse medication;
continue driving after becoming impaired or unsafe.

3. Medication
Driver is responsible for understanding medication warnings/effects.

Drivflo does not require disclosure of diagnosis merely because medication is used.

Where a legitimate safety concern exists, Drivflo may request limited lawful fitness-to-drive confirmation.

4. Suspected Impairment
Drivflo may stop an Assignment, direct Driver not to operate a vehicle, arrange recovery, temporarily restrict access and investigate, subject to applicable legal requirements.

5. Self-Reporting
Driver who becomes unsafe must stop as soon as safe, secure the vehicle and contact Drivflo as soon as safely possible.

6. Testing/Assessment
Testing/medical confirmation will only be required where legally permitted and reasonably connected to legitimate safety/qualification purposes.

7. Consequences
Impaired performance may result in removal from Assignment and suspension/termination, subject to applicable law.',
  'driver',
  true,
  '2026-08-19'
);

insert into legal_documents (slug, version, title, body, audience, is_current, effective_date)
values (
  'driver_standards_code_of_conduct',
  1,
  'Driver Standards and Code of Conduct',
  '1. Standard
Drivers must perform accepted Assignments safely, lawfully, professionally and honestly.

2. Independence
Drivers choose availability and may decline Assignments before acceptance.

Drivers may work for other companies/competitors and are not exclusive to Drivflo.

3. Safe Driving
Drivers must hold proper licence, obey traffic laws, use seatbelts, avoid distracted driving, adapt to conditions and refuse unsafe vehicles.

4. Prohibited Vehicle Use
No unauthorized passengers, third-party drivers, personal errands, racing, smoking/vaping, unauthorized towing, key duplication, customer-property use or unnecessary personal stops.

5. Professional Conduct
No harassment, threats, discrimination, improper solicitation, false authority, promises of refund/repair/financing or other unauthorized commitments.

6. Personal Vehicle
Any personal vehicle used for Drivflo must be legally registered, appropriately insured, roadworthy and maintained at Driver expense.

7. Tickets
Driver is responsible for Driver-caused tickets/fines/parking/impound costs.

8. No Repairs
Driver cannot authorize Assignment-vehicle repairs.

Only emergency exception: tow to nearest reasonably appropriate mechanic/safe location when prior approval cannot reasonably be obtained and immediate movement is necessary for safety.

Driver must call Drivflo as soon as able and safe.

9. Documentation
Accurate inspection photos, VIN, odometer, fuel/charge, wait/idle time, receipts and delivery records are mandatory when requested.

10. NDA
Driver is bound by the confidentiality/NDA in the Driver Agreement.

11. Incident Cooperation
Driver must cooperate with legitimate accident/damage/safety investigations.

12. Enforcement
Serious/repeated violations may result in suspension/termination subject to law.',
  'driver',
  true,
  '2026-08-19'
);

insert into legal_documents (slug, version, title, body, audience, is_current, effective_date)
values (
  'vehicle_inspection_damage_policy',
  1,
  'Vehicle Inspection and Damage Policy',
  '1. Purpose
Create consistent identity/visible-condition records before/after vehicle Assignments.

Condition report is not a mechanical inspection, safety certification or warranty.

2. Dealer Responsibility
Dealer is responsible for lawful authority, roadworthiness, mechanical fitness, plates/permits/registration and disclosure of known material safety/operating defects, including for trade-ins.

3. Pickup Inspection
Standard photo sequence:
front
driver-front
driver side
driver-rear
rear
passenger-rear
passenger side
passenger-front
close-ups of visible damage

Also record VIN, odometer, fuel/charge, warning lights, keys/accessories as required.

4. VIN Verification
Verify VIN at windshield or driver door/door-pillar and resolve mismatch before departure.

5. Unsafe Vehicles
Driver must not operate a vehicle reasonably believed unsafe or unlawful.

6. No Unauthorized Repairs
No emergency/non-emergency repairs, diagnostics, parts or service without prior Drivflo approval.

Emergency exception permits only a tow to nearest reasonably appropriate mechanic/safe location when immediate movement is necessary and prior approval cannot reasonably be obtained.

Driver must contact Drivflo as soon as safely possible.

7. Dealer Cost Responsibility
Dealer pays reasonable costs caused by pre-existing roadworthiness/mechanical condition/undisclosed defect of delivery vehicle or trade, including towing, approved repairs/diagnostics, Driver wait/idle, return travel, flights, ferries, accommodation, rental/taxi/rideshare, storage and other interruption costs.

8. Delivery Inspection
Complete required final photos, odometer/fuel/charge, keys/accessories, delivery time/location and recipient acknowledgement.

9. Damage Reporting
Photograph, record, notify Drivflo, preserve evidence, do not admit liability or promise repair/payment.

10. Damage Investigation
Drivflo may review photos, GPS, timestamps, statements, repair estimates, dashcam/third-party evidence and insurance information.

Investigation is not admission of liability.

11. Repairs Before Claim Inspection
Where practicable, non-emergency alleged delivery-damage repairs should not occur until Drivflo/insurer has had reasonable opportunity to inspect/document.

Urgent safety work is not restricted.',
  'driver',
  true,
  '2026-08-19'
);

insert into legal_documents (slug, version, title, body, audience, is_current, effective_date)
values (
  'driver_expense_reimbursement_policy',
  1,
  'Driver Expense and Reimbursement Policy',
  '1. General
Driver may spend money on behalf of an Assignment only where:
included in Assignment;
pre-approved by Drivflo;
expressly authorized by policy;
emergency towing exception applies.

2. Potentially Reimbursable
Subject to approval/Assignment:
ferries;
tolls;
approved fuel/charging;
parking;
approved taxi/rideshare/rental;
approved flight/accommodation;
authorized towing;
other expressly approved expenses.

3. Personal Vehicle Costs
Unless expressly agreed or required by law, Drivflo does not reimburse ordinary personal-vehicle:
maintenance;
repair;
tires/brakes/service;
depreciation/wear;
insurance/registration;
deductibles/damage;
tickets/parking/impound;
financing.

4. Assignment-Vehicle Repairs
No repairs/diagnostics/parts/service without prior Drivflo approval.

5. Emergency Towing Exception
If disabled and immediate movement is needed for safety and approval cannot reasonably be obtained, Driver may authorize only tow to nearest reasonably appropriate mechanic/safe location.

No repairs are authorized by this exception.

Driver must contact Drivflo as soon as safely possible.

6. Receipts
Submit itemized receipt or reasonable proof showing provider, date, amount, nature and Assignment.

7. Unapproved Expenses
Drivflo may decline discretionary reimbursement for unauthorized, personal, unnecessary, excessive, undocumented, misconduct-caused or Driver-ticket/personal-vehicle expenses, subject to applicable law.

8. Expense Fraud
False, altered or duplicate expense submissions constitute serious misconduct.',
  'driver',
  true,
  '2026-08-19'
);

