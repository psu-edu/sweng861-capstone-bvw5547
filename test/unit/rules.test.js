// Unit tests for the business rules and input checks in backend/rules.js.
const {
  cleanText,
  cleanSkills,
  validateRegistration,
  validateProfile,
  validateJob,
  checkEligibility,
  canTransition,
  buildJobFilter
} = require('../../backend/rules');

describe('cleanText and cleanSkills', () => {
  test('trims text and returns empty for non strings', () => {
    expect(cleanText('  hi ')).toBe('hi');
    expect(cleanText(42)).toBe('');
    expect(cleanText(undefined)).toBe('');
  });

  test('dedupes, trims, and caps skills at 20', () => {
    const skills = cleanSkills([' python', 'python', '', 'sql', 7, ...Array(30).fill('x')]);

    expect(skills.slice(0, 3)).toEqual(['python', 'sql', 'x']);
    expect(skills.length).toBeLessThanOrEqual(20);
    expect(cleanSkills('python')).toEqual([]);
  });
});

describe('validateRegistration', () => {
  test('accepts a complete student registration', () => {
    const { errors, value } = validateRegistration({ email: 'Ann@PSU.edu', name: ' Ann ', password: 'Password1', role: 'student' });

    expect(errors).toEqual([]);
    expect(value).toEqual({ email: 'ann@psu.edu', name: 'Ann', password: 'Password1', role: 'student' });
  });

  test('reports every problem at once', () => {
    const { errors } = validateRegistration({ email: 'nope', name: '', password: 'short', role: 'dean' });

    expect(errors).toHaveLength(4);
  });
});

describe('validateProfile', () => {
  test('requires major and a valid gpa for students', () => {
    const { errors } = validateProfile('student', { major: '', gpa: 4.5 });

    expect(errors).toEqual(['Major is required', 'GPA must be a number from 0 to 4']);
  });

  test('accepts a student profile and rejects a bad resume link', () => {
    const good = validateProfile('student', { major: 'CS', gpa: '3.7', skills: ['go'], resumeUrl: 'https://x.y/r.pdf' });
    const bad = validateProfile('student', { major: 'CS', gpa: 3.7, resumeUrl: 'ftp://x' });

    expect(good.errors).toEqual([]);
    expect(good.value).toEqual({ major: 'CS', gpa: 3.7, skills: ['go'], resumeUrl: 'https://x.y/r.pdf' });
    expect(bad.errors).toEqual(['Resume must be an http or https link']);
  });

  test('requires department for professors and ignores student fields', () => {
    const { errors, value } = validateProfile('professor', { department: 'EECS', contact: 'x@psu.edu', gpa: 4 });

    expect(errors).toEqual([]);
    expect(value).toEqual({ department: 'EECS', contact: 'x@psu.edu' });
  });
});

describe('validateJob', () => {
  const base = { title: 'RA for ML lab', department: 'CS', type: 'RA' };

  test('accepts a minimal job and fills defaults', () => {
    const { errors, value } = validateJob(base);

    expect(errors).toEqual([]);
    expect(value.minGpa).toBe(0);
    expect(value.skills).toEqual([]);
    expect(value.hoursPerWeek).toBeNull();
  });

  test('rejects missing title, bad type, bad hours, and bad gpa', () => {
    const { errors } = validateJob({ title: ' ', department: 'CS', type: 'intern', hoursPerWeek: 50, minGpa: 5 });

    expect(errors).toEqual([
      'Title is required',
      'Type must be one of: RA, TA',
      'Hours per week must be a whole number from 1 to 40',
      'Minimum GPA must be a number from 0 to 4'
    ]);
  });

  test('accepts numeric strings from a form', () => {
    const { errors, value } = validateJob({ ...base, hoursPerWeek: '10', minGpa: '3.5' });

    expect(errors).toEqual([]);
    expect(value.hoursPerWeek).toBe(10);
    expect(value.minGpa).toBe(3.5);
  });
});

describe('checkEligibility', () => {
  const job = { status: 'open', minGpa: 3.0 };
  const profile = { major: 'CS', gpa: 3.5, resumeUrl: 'https://x.y/r.pdf' };

  test('passes a complete profile above the bar', () => {
    expect(checkEligibility(profile, job)).toEqual({ ok: true, reason: null });
  });

  test('passes when gpa equals the minimum', () => {
    expect(checkEligibility({ ...profile, gpa: 3.0 }, job).ok).toBe(true);
  });

  test('fails when the gpa is below the minimum', () => {
    const result = checkEligibility({ ...profile, gpa: 2.9 }, job);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('This opening requires a GPA of 3.00 or higher');
  });

  test('fails on a closed opening before looking at the profile', () => {
    expect(checkEligibility(profile, { ...job, status: 'closed' }).reason).toBe('This opening is closed');
  });

  test('fails on a missing or incomplete profile', () => {
    expect(checkEligibility(null, job).reason).toMatch(/Complete your profile/);
    expect(checkEligibility({ major: 'CS', gpa: null }, job).reason).toMatch(/Complete your profile/);
    expect(checkEligibility({ major: 'CS', gpa: 3.9, resumeUrl: null }, job).reason).toMatch(/resume link/);
  });
});

describe('canTransition', () => {
  test('allows the forward moves', () => {
    expect(canTransition('submitted', 'reviewed')).toBe(true);
    expect(canTransition('submitted', 'accepted')).toBe(true);
    expect(canTransition('reviewed', 'rejected')).toBe(true);
  });

  test('blocks moving backwards, staying put, or leaving a decided state', () => {
    expect(canTransition('reviewed', 'submitted')).toBe(false);
    expect(canTransition('submitted', 'submitted')).toBe(false);
    expect(canTransition('accepted', 'rejected')).toBe(false);
    expect(canTransition('rejected', 'reviewed')).toBe(false);
    expect(canTransition('submitted', 'hired')).toBe(false);
  });
});

describe('buildJobFilter', () => {
  test('defaults to open openings', () => {
    expect(buildJobFilter({})).toEqual({ status: 'open' });
  });

  test('maps every supported query value', () => {
    const filter = buildJobFilter({ status: 'closed', department: 'c.s', type: 'TA', maxGpa: '3.2', q: 'vision' });

    expect(filter.status).toBe('closed');
    expect(filter.department).toEqual(/c\.s/i);
    expect(filter.type).toBe('TA');
    expect(filter.minGpa).toEqual({ $lte: 3.2 });
    expect(filter.$text).toEqual({ $search: 'vision' });
  });

  test('ignores values it does not understand', () => {
    expect(buildJobFilter({ status: 'draft', type: 'intern', maxGpa: '9' })).toEqual({ status: 'open' });
  });
});
