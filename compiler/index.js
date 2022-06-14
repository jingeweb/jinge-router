const { JingeComponentRule, JingeTemplateRule } = require('jinge-compiler');
const alias = require('./alias');
const JingeTemplateRuleWithRouterAlias = {
  test: JingeTemplateRule.test,
  use: {
    loader: JingeTemplateRule.use,
    options: {
      componentAlias: alias,
    },
  },
};
const JingeRulesWithRouterAlias = [JingeComponentRule, JingeTemplateRuleWithRouterAlias];
module.exports = {
  RouterAlias: alias,
  JingeComponentRule,
  JingeTemplateRuleWithRouterAlias,
  JingeRulesWithRouterAlias,
};
