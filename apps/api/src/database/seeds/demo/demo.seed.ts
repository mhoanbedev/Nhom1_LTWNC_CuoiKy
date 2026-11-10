import type { Faker } from '@faker-js/faker';
import {
  ApplicationActor,
  ApplicationStatus,
  CompanyStatus,
  JobStatus,
  NotificationType,
  ProfileStep,
  Role,
  UserStatus,
  WorkMode,
  normalizeSearchText,
  type Locale,
  type ProfileSnapshot,
} from '@ltwnc/shared';
import type { EntityManager, ObjectLiteral, Repository } from 'typeorm';
import { uniqueSlug } from '../../../common/utils/unique-slug';
import { ApplicationNote } from '../../../modules/applications/entities/application-note.entity';
import { ApplicationStatusHistory } from '../../../modules/applications/entities/application-status-history.entity';
import { Application } from '../../../modules/applications/entities/application.entity';
import { CompanyTranslation } from '../../../modules/companies/entities/company-translation.entity';
import { Company } from '../../../modules/companies/entities/company.entity';
import { CvFile } from '../../../modules/cvs/entities/cv-file.entity';
import { JobSkill } from '../../../modules/jobs/entities/job-skill.entity';
import { JobTranslation } from '../../../modules/jobs/entities/job-translation.entity';
import { Job } from '../../../modules/jobs/entities/job.entity';
import { SavedJob } from '../../../modules/jobs/entities/saved-job.entity';
import { jobSlug } from '../../../modules/jobs/recruiter-jobs.service';
import { Industry } from '../../../modules/meta/entities/industry.entity';
import { Location } from '../../../modules/meta/entities/location.entity';
import { Skill } from '../../../modules/meta/entities/skill.entity';
import { Notification } from '../../../modules/notifications/entities/notification.entity';
import { CandidateProfile } from '../../../modules/profiles/entities/candidate-profile.entity';
import { CandidateSkill } from '../../../modules/profiles/entities/candidate-skill.entity';
import { Education } from '../../../modules/profiles/entities/education.entity';
import { Project } from '../../../modules/profiles/entities/project.entity';
import { User } from '../../../modules/users/entities/user.entity';
import { applicationPath } from './application-path';
import {
  COMPANIES,
  HEADLINES,
  MAJORS,
  NOTES,
  ROLES,
  SCHOOLS,
  STATUS_NOTES,
  jobDescription,
  type RoleTemplate,
} from './demo-content';

/** Mọi tài khoản demo có đuôi email này (trừ admin); chạy lại seed xóa đúng các tài khoản đó. */
export const DEMO_EMAIL_DOMAIN = 'demo.vn';
/** Mật khẩu chung của mọi tài khoản demo (ghi trong README). */
export const DEMO_PASSWORD = 'Demo@2026';

export const DEMO_ACCOUNTS = {
  recruiter: `recruiter@${DEMO_EMAIL_DOMAIN}`,
  recruiterPending: `recruiter.pending@${DEMO_EMAIL_DOMAIN}`,
  candidate: `candidate@${DEMO_EMAIL_DOMAIN}`,
  candidateNew: `candidate.new@${DEMO_EMAIL_DOMAIN}`,
} as const;

const CANDIDATE_COUNT = 300;
const JOB_COUNT = 300;
/** Một tin của recruiter@demo.vn có trên 250 đơn để demo danh sách dài. */
const BIG_JOB_APPLICATIONS = 255;
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

export interface DemoCv {
  publicId: string;
  originalName: string;
  size: number;
}

export interface DemoSeedDeps {
  faker: Faker;
  /** Hash của DEMO_PASSWORD (hash một lần, dùng cho mọi tài khoản). */
  passwordHash: string;
  /** 3 CV mẫu đã upload lên Cloudinary (folder `seed/`), dùng chung. */
  cvs: readonly DemoCv[];
  now: Date;
}

export interface DemoSeedResult {
  companies: number;
  candidates: number;
  jobs: number;
  applications: number;
  notifications: number;
  savedJobs: number;
}

/**
 * Xóa dữ liệu demo cũ: đơn vào tin của công ty demo (kể cả đơn của tài khoản không phải demo, vì
 * khóa ngoại đơn → tin là NO ACTION), rồi các tài khoản demo; công ty, tin, hồ sơ, CV, thông báo...
 * xóa theo cascade. Dữ liệu tự tạo khi dev (email khác) giữ nguyên.
 */
export async function wipeDemo(manager: EntityManager): Promise<void> {
  const demoUsers = `SELECT id FROM users WHERE email LIKE $1 AND role <> 'ADMIN'`;
  const pattern = [`%@${DEMO_EMAIL_DOMAIN}`];
  await manager.query(
    `DELETE FROM applications
      WHERE candidate_id IN (${demoUsers})
         OR job_id IN (SELECT j.id FROM jobs j JOIN companies c ON c.id = j.company_id
                        WHERE c.owner_id IN (${demoUsers}))`,
    pattern,
  );
  await manager.query(`DELETE FROM users WHERE email LIKE $1 AND role <> 'ADMIN'`, pattern);
}

/** Ghi nhiều dòng theo lô để không vượt giới hạn tham số của PostgreSQL. */
async function insertMany<T extends ObjectLiteral>(
  repository: Repository<T>,
  rows: Partial<T>[],
  chunk = 200,
): Promise<void> {
  for (let index = 0; index < rows.length; index += chunk) {
    await repository.insert(rows.slice(index, index + chunk));
  }
}

interface GeneratedCandidate {
  user: Partial<User> & { id: string; email: string; name: string };
  complete: boolean;
  role: RoleTemplate;
  snapshot: ProfileSnapshot['profile'];
  defaultCvId: string | null;
}

interface GeneratedJob {
  job: Partial<Job> & { id: string; companyId: string; status: JobStatus };
  title: { vi: string; en: string | null };
  ownerId: string;
  /** Mốc đầu, cuối nhận đơn (đã đăng mới có). */
  window: { from: Date; to: Date } | null;
  isOpen: boolean;
}

/**
 * Dữ liệu demo theo bảng seed của đặc tả (mục 10): 12 công ty (8 duyệt, 3 chờ, 1 từ chối), 300 ứng
 * viên, 300 tin đủ trạng thái, hơn 600 đơn đủ 6 trạng thái kèm lịch sử, ghi chú; thông báo, tin đã
 * lưu. Ghi thẳng vào DB trong transaction của nơi gọi; Faker có seed cố định nên lần nào cũng giống.
 */
export async function seedDemo(
  manager: EntityManager,
  deps: DemoSeedDeps,
): Promise<DemoSeedResult> {
  const { faker: f, now } = deps;
  const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * DAY);
  const between = (from: Date, to: Date) =>
    new Date(f.number.int({ min: from.getTime(), max: Math.max(from.getTime(), to.getTime()) }));

  // --- Danh mục (đã seed trước) ---
  const skills = await manager.getRepository(Skill).find();
  const skillBySlug = new Map(skills.map((skill) => [skill.slug, skill]));
  const industries = new Map(
    (await manager.getRepository(Industry).find()).map((row) => [row.slug, row.id]),
  );
  const locations = await manager.getRepository(Location).find();
  const locationByCode = new Map(locations.map((row) => [row.code, row.id]));
  const skillId = (slug: string) => {
    const skill = skillBySlug.get(slug);
    if (!skill) throw new Error(`Thiếu kỹ năng ${slug} trong danh mục: chạy make seed trước`);
    return skill.id;
  };

  const users = manager.getRepository(User);
  const baseUser = { passwordHash: deps.passwordHash, status: UserStatus.ACTIVE };

  // --- Nhà tuyển dụng và công ty ---
  const companyRows: Partial<Company>[] = [];
  const companyTranslations: Partial<CompanyTranslation>[] = [];
  const recruiters: (Partial<User> & { id: string })[] = [];
  const owners: { companyId: string; ownerId: string; status: CompanyStatus; name: string }[] = [];
  for (const [index, template] of COMPANIES.entries()) {
    const status =
      index < 8
        ? CompanyStatus.APPROVED
        : index < 11
          ? CompanyStatus.PENDING
          : CompanyStatus.REJECTED;
    const email =
      index === 0
        ? DEMO_ACCOUNTS.recruiter
        : index === 8
          ? DEMO_ACCOUNTS.recruiterPending
          : `hr${index + 1}@${DEMO_EMAIL_DOMAIN}`;
    const ownerId = f.string.uuid();
    const companyId = f.string.uuid();
    const createdAt = at(f.number.int({ min: 150, max: 365 }));
    recruiters.push({
      ...baseUser,
      id: ownerId,
      email,
      name: f.person.fullName(),
      role: Role.RECRUITER,
      preferredLocale: 'vi',
      createdAt,
      updatedAt: createdAt,
    });
    companyRows.push({
      id: companyId,
      ownerId,
      status,
      rejectReason:
        status === CompanyStatus.REJECTED ? 'Chưa cung cấp giấy phép kinh doanh hợp lệ.' : null,
      website: template.website,
      size: template.size,
      industryId: industries.get(template.industry) ?? null,
      locationId: locationByCode.get(template.location) ?? null,
      address: f.location.streetAddress(),
      approvedAt:
        status === CompanyStatus.APPROVED ? at(f.number.int({ min: 120, max: 140 })) : null,
      createdAt,
      updatedAt: createdAt,
    });
    owners.push({ companyId, ownerId, status, name: template.vi });
    const companyRepo = manager.getRepository(CompanyTranslation);
    for (const locale of ['vi', 'en'] as const) {
      const name = template[locale];
      const slug = await uniqueSlug(name, locale === 'vi' ? 'cong-ty' : 'company', (candidate) =>
        companyRepo.existsBy({ locale, slug: candidate }),
      );
      companyTranslations.push({
        companyId,
        locale,
        name,
        slug,
        description:
          locale === 'vi'
            ? `${name} là doanh nghiệp trong lĩnh vực ${template.industry}, luôn chào đón sinh viên thực tập.`
            : `${name} welcomes interns who want to grow with real projects.`,
        searchText: normalizeSearchText(name),
      });
    }
  }
  await insertMany(users, recruiters);
  await insertMany(manager.getRepository(Company), companyRows);
  await insertMany(manager.getRepository(CompanyTranslation), companyTranslations);
  for (const owner of owners) await users.update(owner.ownerId, { companyId: owner.companyId });

  // --- Ứng viên, hồ sơ, CV ---
  const candidates: GeneratedCandidate[] = [];
  const profiles: Partial<CandidateProfile>[] = [];
  const educations: Partial<Education>[] = [];
  const candidateSkills: Partial<CandidateSkill>[] = [];
  const projects: Partial<Project>[] = [];
  const cvFiles: Partial<CvFile>[] = [];
  for (let index = 0; index < CANDIDATE_COUNT; index += 1) {
    const email =
      index === 0
        ? DEMO_ACCOUNTS.candidate
        : index === 1
          ? DEMO_ACCOUNTS.candidateNew
          : `ungvien${String(index + 1).padStart(3, '0')}@${DEMO_EMAIL_DOMAIN}`;
    const id = f.string.uuid();
    const name = index === 0 ? 'Nguyễn Văn An' : f.person.fullName();
    const createdAt = at(f.number.int({ min: 60, max: 200 }));
    const locale: Locale = index === 0 || f.number.float() < 0.8 ? 'vi' : 'en';
    const user = {
      ...baseUser,
      id,
      email,
      name,
      role: Role.CANDIDATE,
      preferredLocale: locale,
      createdAt,
      updatedAt: createdAt,
    };
    const role = f.helpers.arrayElement(ROLES);
    // candidate.new: hồ sơ trống (demo PROFILE_INCOMPLETE); 8% chỉ có bước 1.
    const level = index === 1 ? 'empty' : index === 0 || f.number.float() > 0.08 ? 'full' : 'basic';
    const snapshot: ProfileSnapshot['profile'] = {
      basic: null,
      education: [],
      skills: [],
      projects: [],
    };
    let defaultCvId: string | null = null;

    if (level !== 'empty') {
      const profileId = f.string.uuid();
      const basic = {
        headline: f.helpers.arrayElement(HEADLINES),
        phone: `09${f.string.numeric(8)}`,
        dateOfBirth: `200${f.number.int({ min: 2, max: 5 })}-0${f.number.int({ min: 1, max: 9 })}-1${f.number.int({ min: 0, max: 9 })}`,
        locationId: f.helpers.arrayElement(locations).id,
        about: 'Mình là sinh viên đam mê công nghệ, muốn tìm môi trường thực tập để học hỏi.',
        links: [{ label: 'GitHub', url: `https://github.com/demo-${index + 1}` }],
      };
      snapshot.basic = basic;
      const steps: ProfileStep[] = [ProfileStep.BASIC];
      if (level === 'full') {
        const startYear = f.number.int({ min: 2021, max: 2023 });
        const educationId = f.string.uuid();
        const school = f.helpers.arrayElement(SCHOOLS);
        const major = f.helpers.arrayElement(MAJORS);
        const gpa = f.number.float({ min: 2.5, max: 3.9, fractionDigits: 2 });
        educations.push({
          id: educationId,
          profileId,
          school,
          major,
          degree: 'Cử nhân',
          startDate: `${startYear}-09-01`,
          endDate: null,
          gpa,
        });
        snapshot.education.push({
          id: educationId,
          school,
          major,
          degree: 'Cử nhân',
          startDate: `${startYear}-09`,
          endDate: null,
          gpa,
        });
        // Kỹ năng: phần lớn khớp một vị trí mẫu (để gợi ý việc có kết quả), thêm vài kỹ năng mềm.
        const owned = new Set([
          ...role.required,
          ...f.helpers.arrayElements(role.preferred, { min: 0, max: role.preferred.length }),
          ...f.helpers.arrayElements(['english', 'teamwork', 'git', 'communication'], {
            min: 1,
            max: 2,
          }),
        ]);
        for (const slug of owned) {
          const skill = skillBySlug.get(slug);
          if (!skill) continue;
          const skillLevel = f.number.int({ min: 2, max: 5 });
          candidateSkills.push({ profileId, skillId: skill.id, level: skillLevel });
          snapshot.skills.push({ skillId: skill.id, slug, name: skill.nameVi, level: skillLevel });
        }
        steps.push(ProfileStep.EDUCATION, ProfileStep.SKILLS);
        if (index === 0 || f.number.float() < 0.5) {
          const projectId = f.string.uuid();
          const project = {
            id: projectId,
            name: `Website quản lý ${f.helpers.arrayElement(['thư viện', 'bán hàng', 'ký túc xá', 'phòng khám'])}`,
            role: 'Thành viên nhóm',
            description: 'Đồ án môn học, làm nhóm 4 người.',
            techStack: [...owned].slice(0, 3),
            url: null,
            startDate: `${startYear + 1}-02`,
            endDate: `${startYear + 1}-06`,
          };
          projects.push({
            ...project,
            profileId,
            startDate: `${project.startDate}-01`,
            endDate: `${project.endDate}-01`,
          });
          snapshot.projects.push(project);
          steps.push(ProfileStep.PROJECTS);
        }
        // CV: 1 bản mặc định; candidate@demo.vn có 2.
        const cvCount = index === 0 ? 2 : 1;
        for (let n = 0; n < cvCount; n += 1) {
          const cv = deps.cvs[(index + n) % deps.cvs.length];
          if (!cv) continue;
          const cvId = f.string.uuid();
          if (n === 0) defaultCvId = cvId;
          cvFiles.push({
            id: cvId,
            candidateId: id,
            originalName: cv.originalName,
            cloudinaryPublicId: cv.publicId,
            size: cv.size,
            isDefault: n === 0,
            deletedAt: null,
            createdAt,
            updatedAt: createdAt,
          });
        }
      }
      profiles.push({
        id: profileId,
        userId: id,
        ...basic,
        completedSteps: steps,
        createdAt,
        updatedAt: createdAt,
      });
    }
    candidates.push({ user, complete: level === 'full', role, snapshot, defaultCvId });
  }
  await insertMany(
    users,
    candidates.map((candidate) => candidate.user),
  );
  await insertMany(manager.getRepository(CandidateProfile), profiles);
  await insertMany(manager.getRepository(Education), educations);
  await insertMany(manager.getRepository(CandidateSkill), candidateSkills);
  await insertMany(manager.getRepository(Project), projects);
  await insertMany(manager.getRepository(CvFile), cvFiles);

  // --- Tin tuyển ---
  const jobs: GeneratedJob[] = [];
  const jobTranslations: Partial<JobTranslation>[] = [];
  const jobSkills: Partial<JobSkill>[] = [];
  const shortIds = new Set<string>();
  const approved = owners.filter((owner) => owner.status === CompanyStatus.APPROVED);
  // Tin của mỗi công ty: duyệt chia đều phần lớn (công ty đầu nhiều hơn), chờ duyệt 2 nháp,
  // bị từ chối 2 tin đã đăng (không còn công khai).
  const plan: { owner: (typeof owners)[number]; kind: 'any' | 'draft' | 'published' }[] = [];
  for (const owner of owners) {
    if (owner.status === CompanyStatus.PENDING)
      plan.push({ owner, kind: 'draft' }, { owner, kind: 'draft' });
    if (owner.status === CompanyStatus.REJECTED)
      plan.push({ owner, kind: 'published' }, { owner, kind: 'published' });
  }
  const first = approved[0];
  if (!first) throw new Error('Thiếu công ty đã duyệt');
  // Tin đầu của recruiter@demo.vn: đang mở, nhận trên 250 đơn.
  plan.unshift({ owner: first, kind: 'published' });
  for (let n = 0; n < 30; n += 1) plan.push({ owner: first, kind: 'any' });
  while (plan.length < JOB_COUNT)
    plan.push({ owner: f.helpers.arrayElement(approved), kind: 'any' });

  for (const [index, { owner, kind }] of plan.entries()) {
    const id = f.string.uuid();
    let shortId = f.string.alphanumeric({ length: 6, casing: 'lower' });
    while (shortIds.has(shortId)) shortId = f.string.alphanumeric({ length: 6, casing: 'lower' });
    shortIds.add(shortId);
    const role = index === 0 ? (ROLES[0] as RoleTemplate) : f.helpers.arrayElement(ROLES);
    const roll = f.number.float();
    const type =
      kind === 'draft'
        ? 'draft'
        : kind === 'published' || index === 0
          ? 'open'
          : roll < 0.08
            ? 'draft'
            : roll < 0.13
              ? 'hidden'
              : roll < 0.28
                ? 'closed'
                : roll < 0.36
                  ? 'expired'
                  : 'open';
    const createdAt = at(f.number.int({ min: 40, max: 110 }));
    const publishedAt = type === 'draft' ? null : new Date(createdAt.getTime() + DAY);
    const closedAt = type === 'closed' ? at(f.number.int({ min: 1, max: 20 })) : null;
    const expiresAt =
      type === 'expired'
        ? at(f.number.int({ min: 1, max: 15 }))
        : type === 'draft' && f.number.float() < 0.5
          ? null
          : new Date(now.getTime() + f.number.int({ min: 7, max: 90 }) * DAY);
    const isPaid = f.number.float() < 0.75;
    const salaryMin = isPaid ? f.number.int({ min: 4, max: 10 }) * 500_000 : null;
    const workMode = f.helpers.weightedArrayElement([
      { weight: 5, value: WorkMode.ONSITE },
      { weight: 3, value: WorkMode.HYBRID },
      { weight: 2, value: WorkMode.REMOTE },
    ]);
    const companyTemplate = COMPANIES[owners.indexOf(owner)];
    const job: GeneratedJob['job'] = {
      id,
      shortId,
      companyId: owner.companyId,
      status:
        type === 'draft'
          ? JobStatus.DRAFT
          : type === 'closed'
            ? JobStatus.CLOSED
            : JobStatus.PUBLISHED,
      isHidden: type === 'hidden',
      hiddenReason: type === 'hidden' ? 'Nội dung tin không đúng sự thật.' : null,
      workMode,
      isPaid,
      salaryMin,
      salaryMax: salaryMin === null ? null : salaryMin + f.number.int({ min: 1, max: 6 }) * 500_000,
      currency: 'VND',
      locationId: companyTemplate ? (locationByCode.get(companyTemplate.location) ?? null) : null,
      address: workMode === WorkMode.REMOTE ? null : f.location.streetAddress(),
      quantity: f.number.int({ min: 1, max: 5 }),
      expiresAt,
      publishedAt,
      closedAt,
      createdAt,
      updatedAt: closedAt ?? publishedAt ?? createdAt,
    };
    const hasEnglish = index === 0 || f.number.float() < 0.7;
    for (const locale of hasEnglish ? (['vi', 'en'] as const) : (['vi'] as const)) {
      const title = role[locale];
      const content = jobDescription(
        locale,
        title,
        locale === 'vi' ? owner.name : (companyTemplate?.en ?? owner.name),
      );
      jobTranslations.push({
        jobId: id,
        locale,
        title,
        slug: jobSlug(title, shortId, locale),
        ...content,
        searchText: normalizeSearchText(
          [title, content.description, content.requirements].join(' '),
        ),
      });
    }
    for (const slug of role.required)
      jobSkills.push({ jobId: id, skillId: skillId(slug), isRequired: true });
    for (const slug of role.preferred)
      jobSkills.push({ jobId: id, skillId: skillId(slug), isRequired: false });
    const windowEnd = closedAt ?? (expiresAt && expiresAt < now ? expiresAt : now);
    jobs.push({
      job,
      title: { vi: role.vi, en: hasEnglish ? role.en : null },
      ownerId: owner.ownerId,
      window: publishedAt ? { from: publishedAt, to: windowEnd } : null,
      isOpen: type === 'open' && owner.status === CompanyStatus.APPROVED,
    });
  }
  await insertMany(
    manager.getRepository(Job),
    jobs.map((row) => row.job),
  );
  await insertMany(manager.getRepository(JobTranslation), jobTranslations);
  await insertMany(manager.getRepository(JobSkill), jobSkills);

  // --- Đơn ứng tuyển, lịch sử, ghi chú, thông báo ---
  const applications: Partial<Application>[] = [];
  const histories: Partial<ApplicationStatusHistory>[] = [];
  const notes: Partial<ApplicationNote>[] = [];
  const notifications: Partial<Notification>[] = [];
  const applied = new Set<string>();
  const applicants = candidates.filter((candidate) => candidate.complete && candidate.defaultCvId);
  const demoCandidate = applicants.find((c) => c.user.email === DEMO_ACCOUNTS.candidate);
  const withWindow = jobs.filter((job) => job.window);
  const bigJob = jobs[0];
  if (!bigJob || !demoCandidate) throw new Error('Thiếu tin hoặc ứng viên demo');

  const finalStatus = () =>
    f.helpers.weightedArrayElement([
      { weight: 35, value: ApplicationStatus.SUBMITTED },
      { weight: 20, value: ApplicationStatus.REVIEWING },
      { weight: 15, value: ApplicationStatus.INTERVIEW },
      { weight: 8, value: ApplicationStatus.PASSED },
      { weight: 15, value: ApplicationStatus.FAILED },
      { weight: 7, value: ApplicationStatus.WITHDRAWN },
    ]);

  const apply = (candidate: GeneratedCandidate, job: GeneratedJob, final: ApplicationStatus) => {
    const key = `${job.job.id}:${candidate.user.id}`;
    if (applied.has(key) || !job.window || !candidate.defaultCvId) return;
    applied.add(key);
    const id = f.string.uuid();
    const path = applicationPath(final, f.number.int({ min: 0, max: 2 }));
    // Chừa mỗi bước sau ít nhất 1 phút trước hiện tại, để lịch sử luôn tăng dần và không ở tương lai.
    const latestSubmit = new Date(now.getTime() - path.length * MINUTE);
    const submittedAt = between(
      job.window.from,
      job.window.to < latestSubmit ? job.window.to : latestSubmit,
    );
    let time = submittedAt;
    for (const [stepIndex, step] of path.entries()) {
      if (step.from !== null) {
        const cap = now.getTime() - (path.length - 1 - stepIndex) * MINUTE;
        const next = time.getTime() + f.number.int({ min: 1, max: 4 }) * DAY;
        time = new Date(Math.max(time.getTime() + 1000, Math.min(cap, next)));
      }
      const note =
        step.actor === ApplicationActor.RECRUITER &&
        (step.to === ApplicationStatus.INTERVIEW ||
          step.to === ApplicationStatus.PASSED ||
          step.to === ApplicationStatus.FAILED) &&
        f.number.float() < 0.5
          ? f.helpers.arrayElement(STATUS_NOTES)
          : null;
      histories.push({
        applicationId: id,
        fromStatus: step.from,
        toStatus: step.to,
        changedById: step.actor === ApplicationActor.CANDIDATE ? candidate.user.id : job.ownerId,
        note,
        createdAt: time,
        updatedAt: time,
      });
      const jobTitle = job.title;
      // Thông báo cho tài khoản demo chính: đủ để thấy danh sách và số chưa đọc.
      if (step.from === null && job.ownerId === recruiters[0]?.id) {
        notifications.push({
          userId: job.ownerId,
          type: NotificationType.NEW_APPLICATION,
          data: {
            applicationId: id,
            jobId: job.job.id,
            jobTitle,
            candidateName: candidate.user.name,
          },
          readAt: null,
          createdAt: time,
          updatedAt: time,
        });
      }
      if (
        step.from !== null &&
        step.actor === ApplicationActor.RECRUITER &&
        candidate === demoCandidate
      ) {
        notifications.push({
          userId: candidate.user.id,
          type: NotificationType.APPLICATION_STATUS_CHANGED,
          data: {
            applicationId: id,
            jobId: job.job.id,
            jobTitle,
            fromStatus: step.from,
            toStatus: step.to,
            note,
            candidateName: null,
          },
          readAt: null,
          createdAt: time,
          updatedAt: time,
        });
      }
    }
    applications.push({
      id,
      jobId: job.job.id,
      candidateId: candidate.user.id,
      cvFileId: candidate.defaultCvId,
      coverLetter:
        f.number.float() < 0.4 ? 'Em rất mong có cơ hội được thực tập tại quý công ty.' : null,
      status: final,
      profileSnapshot: {
        candidate: { name: candidate.user.name, email: candidate.user.email, avatarUrl: null },
        profile: candidate.snapshot,
        takenAt: submittedAt.toISOString(),
      },
      submittedAt,
      createdAt: submittedAt,
      updatedAt: time,
    });
    if (job.ownerId === recruiters[0]?.id && f.number.float() < 0.25) {
      for (let n = 0; n < f.number.int({ min: 1, max: 2 }); n += 1) {
        const noteAt = between(submittedAt, time);
        notes.push({
          applicationId: id,
          authorId: job.ownerId,
          content: f.helpers.arrayElement(NOTES),
          createdAt: noteAt,
          updatedAt: noteAt,
        });
      }
    }
  };

  // candidate@demo.vn: 5 đơn, mỗi đơn một trạng thái khác nhau, vào tin đang mở.
  const openJobs = jobs.filter((job) => job.isOpen);
  for (const [n, status] of [
    ApplicationStatus.SUBMITTED,
    ApplicationStatus.REVIEWING,
    ApplicationStatus.INTERVIEW,
    ApplicationStatus.PASSED,
    ApplicationStatus.WITHDRAWN,
  ].entries()) {
    const job = openJobs[n + 1];
    if (job) apply(demoCandidate, job, status);
  }
  for (const candidate of f.helpers.arrayElements(applicants, BIG_JOB_APPLICATIONS)) {
    apply(candidate, bigJob, finalStatus());
  }
  for (const candidate of applicants) {
    for (const job of f.helpers.arrayElements(withWindow, { min: 1, max: 2 })) {
      apply(candidate, job, finalStatus());
    }
  }
  // Thông báo cũ coi như đã đọc; chỉ vài cái mới nhất còn chưa đọc.
  notifications.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  const unreadLeft = new Map<string, number>();
  for (const notification of notifications) {
    const userId = notification.userId ?? '';
    const left = unreadLeft.get(userId) ?? 5;
    if (left <= 0) notification.readAt = notification.createdAt ?? now;
    unreadLeft.set(userId, left - 1);
  }
  const companyOne = owners[0];
  if (companyOne) {
    notifications.push({
      userId: companyOne.ownerId,
      type: NotificationType.COMPANY_APPROVED,
      data: {
        companyId: companyOne.companyId,
        companyName: { vi: COMPANIES[0]?.vi ?? '', en: COMPANIES[0]?.en ?? null },
      },
      readAt: at(120),
      createdAt: at(130),
      updatedAt: at(120),
    });
  }

  // Tin đã lưu: candidate@demo.vn lưu 6 tin đang mở, thêm 100 ứng viên khác mỗi người 1–3 tin.
  const saved: Partial<SavedJob>[] = [];
  const savedKeys = new Set<string>();
  const save = (candidateId: string, jobId: string) => {
    const key = `${candidateId}:${jobId}`;
    if (savedKeys.has(key)) return;
    savedKeys.add(key);
    const savedAt = at(f.number.int({ min: 0, max: 20 }));
    saved.push({ candidateId, jobId, createdAt: savedAt, updatedAt: savedAt });
  };
  for (const job of openJobs.slice(6, 12)) save(demoCandidate.user.id, job.job.id);
  for (const candidate of f.helpers.arrayElements(applicants, 100)) {
    for (const job of f.helpers.arrayElements(openJobs, { min: 1, max: 3 })) {
      save(candidate.user.id, job.job.id);
    }
  }

  await insertMany(manager.getRepository(Application), applications);
  await insertMany(manager.getRepository(ApplicationStatusHistory), histories);
  await insertMany(manager.getRepository(ApplicationNote), notes);
  await insertMany(manager.getRepository(Notification), notifications);
  await insertMany(manager.getRepository(SavedJob), saved);

  return {
    companies: owners.length,
    candidates: candidates.length,
    jobs: jobs.length,
    applications: applications.length,
    notifications: notifications.length,
    savedJobs: saved.length,
  };
}
