const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isInternalId(value) {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
}

function resolveClassName(user) {
  const enrolledClass = (user?.enrollments || [])
    .map((enrollment) => enrollment.course?.title)
    .find((title) => title && !isInternalId(title));
  if (enrolledClass) return enrolledClass;

  const storedClass = user?.className || user?.class || "";
  return isInternalId(storedClass) ? "" : storedClass;
}

function safeClassName(value, fallback = "Unassigned class") {
  return value && !isInternalId(value) ? value : fallback;
}

module.exports = { isInternalId, resolveClassName, safeClassName };
