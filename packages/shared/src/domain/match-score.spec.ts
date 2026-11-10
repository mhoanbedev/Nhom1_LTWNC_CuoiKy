import { matchScore } from './match-score';

const required = (skillId: string) => ({ skillId, isRequired: true });
const preferred = (skillId: string) => ({ skillId, isRequired: false });

describe('matchScore', () => {
  const job = [required('node'), required('sql'), preferred('docker')];

  it('ứng viên không có kỹ năng nào thì 0', () => {
    expect(matchScore([], job)).toEqual({ score: 0, matchedSkillIds: [] });
  });

  it('khớp hết thì 100, không phụ thuộc kỹ năng thừa của ứng viên', () => {
    expect(matchScore(['docker', 'sql', 'node', 'react'], job)).toEqual({
      score: 100,
      matchedSkillIds: ['node', 'sql', 'docker'],
    });
  });

  it('chỉ khớp kỹ năng ưu tiên: 1 trên tổng trọng số 5 là 20', () => {
    expect(matchScore(['docker'], job)).toEqual({ score: 20, matchedSkillIds: ['docker'] });
  });

  it('kỹ năng bắt buộc nặng gấp đôi: khớp 1 bắt buộc là 40', () => {
    expect(matchScore(['node'], job).score).toBe(40);
  });

  it('làm tròn: khớp 2 trên trọng số 3 là 67', () => {
    expect(matchScore(['node'], [required('node'), preferred('git')]).score).toBe(67);
  });

  it('tin không có kỹ năng nào thì 0, không chia cho 0', () => {
    expect(matchScore(['node'], [])).toEqual({ score: 0, matchedSkillIds: [] });
  });
});
