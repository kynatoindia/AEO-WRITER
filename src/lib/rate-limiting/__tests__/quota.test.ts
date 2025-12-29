import { PLAN_QUOTAS } from '../quota-constants';

describe('Quota System', () => {
  describe('PLAN_QUOTAS configuration', () => {
    it('should have correct structure for free plan', () => {
      expect(PLAN_QUOTAS.free).toEqual({
        contentGeneration: 10,
        apiCalls: 100,
        projects: 3,
        tokensPerMonth: 10000,
        costLimitUsd: 5.0,
      });
    });

    it('should have correct structure for pro plan', () => {
      expect(PLAN_QUOTAS.pro).toEqual({
        contentGeneration: 500,
        apiCalls: 5000,
        projects: 50,
        tokensPerMonth: 500000,
        costLimitUsd: 50.0,
      });
    });

    it('should have unlimited quotas for enterprise plan', () => {
      expect(PLAN_QUOTAS.enterprise).toEqual({
        contentGeneration: -1,
        apiCalls: -1,
        projects: -1,
        tokensPerMonth: -1,
        costLimitUsd: -1,
      });
    });

    it('should have all required quota types for each plan', () => {
      const requiredQuotaTypes = [
        'contentGeneration',
        'apiCalls', 
        'projects',
        'tokensPerMonth',
        'costLimitUsd'
      ];

      Object.keys(PLAN_QUOTAS).forEach(planName => {
        const plan = PLAN_QUOTAS[planName as keyof typeof PLAN_QUOTAS];
        requiredQuotaTypes.forEach(quotaType => {
          expect(plan).toHaveProperty(quotaType);
          expect(typeof plan[quotaType as keyof typeof plan]).toBe('number');
        });
      });
    });

    it('should have progressive limits across plans', () => {
      const { free, pro, enterprise } = PLAN_QUOTAS;
      
      // Pro should have higher limits than free (except enterprise which is unlimited)
      expect(pro.contentGeneration).toBeGreaterThan(free.contentGeneration);
      expect(pro.apiCalls).toBeGreaterThan(free.apiCalls);
      expect(pro.projects).toBeGreaterThan(free.projects);
      expect(pro.tokensPerMonth).toBeGreaterThan(free.tokensPerMonth);
      expect(pro.costLimitUsd).toBeGreaterThan(free.costLimitUsd);
      
      // Enterprise should be unlimited (-1)
      expect(enterprise.contentGeneration).toBe(-1);
      expect(enterprise.apiCalls).toBe(-1);
      expect(enterprise.projects).toBe(-1);
      expect(enterprise.tokensPerMonth).toBe(-1);
      expect(enterprise.costLimitUsd).toBe(-1);
    });
  });
});