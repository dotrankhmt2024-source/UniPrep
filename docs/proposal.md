# 1. Problem, context, target users, and product’s value

## 1.1. Problem and context

At the university level, learning materials are typically distributed through LMS platforms like Moodle. While an LMS is useful for posting content, collecting assignments, and recording grades, it falls short in effectively supporting students' actual review and exam preparation process. When preparing for exams, students commonly face three main challenges:

- **Dispersed learning materials:** slides, notes, assignments, and past exam papers are scattered across different places, forcing students to manually gather them through personal notes or group chats.
- **Limited practice opportunities with feedback:** there is a lack of realistic practice exams, immediate grading, and error analysis.
- **Difficulty tracking review progress:** students lack clarity on which chapters they have reviewed, which topics remain weak, or their overall level of readiness.

This project aims to build an online learning and exam preparation platform to complement, rather than replace, existing LMS platforms.

## 1.2. Target users, roles, and expectations

| Role | Expectations |
|---|---|
| Learner (Student) | Organize exam preparation by subject and chapter; review learning materials in one place; take timed practice exams with immediate grading and error review; track review progress and resume from where they left off; receive notifications about new content and deadlines. |
| Instructor | Create courses and structure content by chapter/lesson; upload materials and build multiple-choice quizzes or practice exams; easily publish or hide content alongside existing LMS workflows; view aggregated results to identify topics students find difficult. |
| Administrator | Manage users, courses, and categories; moderate reported content; track basic statistics such as enrollments and completion rates; maintain logs of critical actions; ensure safe and stable system operations. |

## 1.3. Product’s value

For students: consolidates dispersed learning materials into an organized review process while clearly displaying exam readiness. For instructors: provides a seamless way to share practice materials and track student weaknesses without altering current LMS management workflows. For the institution: offers an easily maintainable system with clear role authorization, administrative logging, and smooth parallel integration with existing infrastructure. Product effectiveness will be demonstrated through a sample course, test data, and measured against acceptance criteria and an evaluation plan.

# 2. Brief analysis of related solutions and expected differentiators

## 2.1. Brief analysis of related solutions

| Platform | Strengths | Limitations |
|---|---|---|
| Moodle | Open-source LMS with high customizability through a plugin ecosystem. | Core default reporting features primary deliver static, retrospective data. |
| Coursera and edX | Structured, self-paced learning paths with built-in progress tracking. | Lacks focus on providing deep analytical dashboards for instructors at a small-classroom scale. |
| Khan Academy | Excels at skill mastery tracking and personalized learning support. | Less emphasis on analyzing learning behavior patterns to identify at-risk students. |

## 2.2. Expected Key Differentiators

- **Retrospective reporting and early forecasting:** A platform that tracks learning behavior (logins, material views, submissions) to trigger early warnings.
- **Explainable and actionable alerts:** The alert system provides underlying rationales, sends automated reminder emails, and highlights at-risk learners for instructors.
- **Centralized and visual dashboard:** The system provides analytical dashboards for instructors and administrators, visualizing learner data over time.

# 3. Functional scope, user stories, and acceptance criteria

## 3.1. Functional scope

- **Account and authorization:** Registration, login/logout, password recovery, user profile, role-based access control across all APIs (Student/Instructor/Admin), account status management, and audit logs for administrative actions.
- **Courses and content:** Course catalog featuring search, filtering, and pagination; course detail pages (syllabus, instructor, prerequisites); chapter-lesson structure supporting text, slides, and attached video files; content management enabling instructors to create, edit, publish, and hide content.
- **Learning and assessment:** Course enrollment, progress tracking, timed practice quizzes with automated grading, instructor feedback on submissions, discussion forums, and learning behavior telemetry (completion time, attempt counts).
- **AI analytics and early warning system (track 5):** Automated risk detection pipeline (FastAPI), instructor analytics dashboard featuring feature-level risk explainability, and in-app intervention messaging.
- **Out-of-scope items:** Live-streaming classrooms, multi-factor authentication, real-money payment gateways, and dynamic AI-generated lesson content.

## 3.2. User stories and acceptance criteria

| Role | User story | acceptance criteria |
|---|---|---|
| Student | As a student, I want to search for and enroll in courses, access learning materials, take practice quizzes, and track my learning progress, so that I can self-monitor my learning and receive early warnings when I fall behind. | Students can search for, enroll in courses, and access published materials. Progress is tracked via completed lessons and quizzes. Learning behavior and assessment results are utilized to detect risk and trigger in-app early warnings. |
| Instructor | As an instructor, I want to view learner performance and early warning indicators on my dashboard, so that I can monitor learning progress and provide timely intervention for struggling learners. | Instructors can monitor progress, assessment results, and learning behavior; at-risk learners are highlighted along with contributing rationales on the dashboard. Instructors can also send direct intervention messages to individual learners. |
| Admin | As an administrator, I want to manage user accounts, course catalogs, content violation reports, and risk detection settings, so that I can maintain secure platform access, moderate content, and manage the early warning system. | Administrators can manage roles, access permissions, course catalogs, and violation reports. Risk detection settings are configurable via the admin portal, with all actions and configuration changes logged in audit trails. |

# 4. Selected advanced components, integration methods, and evaluation

## 4.1. Selected advanced component and technical complexity

Track 5 aims to transform raw learner interaction data into actionable insights to support both learners and instructors. Implementing this component requires resolving the following technical challenges:

- **Data Tracking and Stream Processing:** Designing an efficient event-logging mechanism that does not overload the system or degrade the primary platform's performance.
- **Predictive Logic and Explainability:** Developing predictive algorithms that prioritize not only forecast accuracy, but also the ability to identify key contributing factors for each prediction to meet the requirement for explainable alerts.
- **Database Schema Design:** Optimizing the database for efficient querying and aggregation of time-series data for analytics dashboards, rather than solely persisting the current system state.

## 4.2. Integration Strategy

- **Data Ingestion Integration (Event Tracking):** Core learning activities—such as clicking on lectures, submitting quizzes, and participating in discussions—will be instrumented with event trackers. As learners interact with the system, these events are automatically logged alongside timestamps and duration metadata, then persisted into the log database without blocking the user experience.
- **Processing Integration (Background Processing):** A background service, such as a scheduled cron job or a message queue consumer, periodically aggregates raw data from the log database to compute relevant features, such as days since last login and completion rate relative to the class average. These features are then fed into the predictive model to update each learner's risk status.
- **UI and Action Integration:**
  - **Instructor/Admin:** An analytics dashboard embedded directly within the course management portal displays charts and a flagged list of at-risk learners, complete with warning rationale.
  - **Learner:** When a risk flag is triggered, the system automatically dispatches personalized in-app notifications or emails containing reminders and recommended catch-up activities for missed coursework.

## 4.3. Data Testing Plan and Evaluation

- **Test Data Source:** The team will utilize simulated data generated from diverse behavioral scenarios or adapt publicly available educational datasets, such as OULAD (Open University Learning Analytics Dataset), for testing purposes.
- **Model Evaluation:** Predictive algorithms will be evaluated using standard metrics such as Precision and Recall to ensure accurate identification. Results will be benchmarked against a baseline approach, such as simple assignment score rule-based logic.
- **Functional Acceptance Criteria (Demo):** Real-time data updates and visualization on the instructor dashboard; accurate classification and flagging of at-risk learners along with feature-level explainability based on simulated data; and automated execution of intervention workflows, such as dispatching in-app notifications or emails to learners.

# 5. Proposed Architecture / Technology Stack, Data Model, or High-Level Diagram

## 5.1. Frontend and Backend

| Frontend |  | Backend |  |
|---|---|---|---|
| Component | Selected Technology | Component | Selected Technology |
| Framework | React (Vite) + TypeScript | Framework | NestJS (Node.js, TypeScript) |
| Styling | Tailwind CSS | ORM | TypeORM |
| Data fetching | Axios | Database | PostgreSQL |
| Charts & UI | Ant Design (Charts, Buttons, Tables) | Auth | JWT (access + refresh) + Passport.js |
| Local State | Redux | Queue | BullMQ (Redis) |
| Realtime (Optional) | Socket.IO client | API Docs | Swagger |

## 5.2. AI service

| Component | Selected Technology / Design |
|---|---|
| Framework | FastAPI (Python) |
| DB Access | Direct read access to PostgreSQL or receiving payloads directly from NestJS |
| Communication Protocol | REST (Synchronous for lightweight jobs) + Queue (Asynchronous for heavy jobs) |

## 5.3. Component interaction diagram

## 5.4. UI/UX

https://www.figma.com/design/6JmtBo2prWLaJPaINgeTQ1/Untitled?node-id=0-1&t=OflfEALWk8DH8EEI-1

# 6. Implementation Plan, Task Allocation, and Key Risks

## 6.1. Timeline and Schedule (Weeks 39–50)

| Week | Key Objectives & Deliverables | Primary Dependencies |
|---|---|---|
| 39 | Finalize requirements, UI/UX wireframes, High-level ERD, RESTful API specs, shared database schema, GitHub Repo, and CI/CD base. | Proposal Approval & Scope Freeze |
| 41-43 | Implement Core MVP modules (Auth, Course/Content, Quiz Engine) and build initial prototype for Direction 5 (Learning Analytics). | Architecture, ERD Schema & API Specs |
| 44 | Integrate core functions, execute system testing, deploy staging prototype, and submit Interim Report (Max 10 pages). | Core MVP & Analytics Prototype |
| 45-46 | Complete all MVP features, refine early-warning recommendation logic, and generate/validate evaluation datasets. | Interim Review Feedback & Staging Base |
| 47 | Conduct functional, security, usability, performance testing, and bug fixing. | Feature Freeze |
| 48 | Stabilize production deployment, evaluate model accuracy, draft Final Report, slides, and demo scripts. | QA Testing Clearance |
| 49 | Rehearse live demo, resolve remaining issues, and finalize complete demo package. | Staging Environment & Draft Slides |
| 50 | Final Deliverables & Defense: Submit Final Report, source code, and complete product release / live demo package | Final Package Clearance |

## 6.2. Team Member Task Allocation

## 6.3. Key Risks and Mitigation Strategies

- **Members failing to update progress on Git/Google Doc:** Set weekly progress checkpoints; require tasks linked to Git commits, Issues, or Pull Requests before logging.
- **Missing project deliverables or submission deadlines:** Establish an internal deadline 48 hours prior to official cutoffs. Conduct early dry-runs for deployment and document consolidation.
