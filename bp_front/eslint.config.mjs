import nextConfig from "eslint-config-next";

const ignoredFiles = [
  {ignores: ['src/__generated__/**']},
]

// Custom rule: prevents color/shape tokens in sx props — use theme tokens instead
const noSxColorPlugin = {
  rules: {
    'no-sx-color': {
      meta: {
        type: 'suggestion',
        messages: {
          noSxColor: "Move '{{key}}' to lib/theme.ts — sx props must not contain color/shape tokens directly.",
        },
      },
      create(context) {
        return {
          JSXAttribute(node) {
            if (node.name.name !== 'sx') return
            if (node.value?.type !== 'JSXExpressionContainer') return
            const expr = node.value.expression
            if (expr.type !== 'ObjectExpression') return
            const forbidden = ['color', 'bgcolor', 'borderRadius', 'fontFamily', 'fontSize']
            for (const prop of expr.properties) {
              if (prop.type !== 'Property') continue
              const key = prop.key.type === 'Identifier' ? prop.key.name :
                          prop.key.type === 'Literal' ? String(prop.key.value) : null
              if (key && forbidden.includes(key)) {
                context.report({ node: prop, messageId: 'noSxColor', data: { key } })
              }
            }
          },
        }
      },
    },
  },
}

const eslintConfig = [
  ...ignoredFiles,
  ...nextConfig,
  {
    plugins: {
      'local': noSxColorPlugin,
    },
    rules: {
      'local/no-sx-color': 'error',
    },
  },
]

export default eslintConfig
