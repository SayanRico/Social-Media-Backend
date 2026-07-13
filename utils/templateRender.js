const safeString = (value, fallback = "") => {
  if (value === undefined || value === null) return fallback;
  return String(value);
};

const renderTemplate = (template, variables = {}) => {
  if (!template) return "";
  return safeString(template)
    .replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => {
      if (
        Object.prototype.hasOwnProperty.call(variables, key) &&
        variables[key] !== undefined &&
        variables[key] !== null
      ) {
        return safeString(variables[key], "");
      }
      return "";
    })
    .trim();
};

module.exports = { renderTemplate, safeString };
