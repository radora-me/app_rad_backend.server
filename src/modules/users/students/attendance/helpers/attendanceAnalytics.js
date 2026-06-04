const { calculatePercentage } = require("./attendanceCalculator");

const toDateKey = (value) => {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);

  if (!Number.isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  return "";
};

const getEligibilityStatus = (percentage) => {
  if (percentage >= 75) {
    return "SAFE";
  }

  if (percentage >= 60) {
    return "WARNING";
  }

  return "CRITICAL";
};

const buildAttendanceSummary = (records = [], holidays = []) => {
  const holidayDates = new Set(
    holidays.map((holiday) => toDateKey(holiday?.date)).filter(Boolean),
  );

  const filteredRecords = records.filter((record) => {
    const recordDate = toDateKey(record?.date);

    return recordDate && !holidayDates.has(recordDate);
  });

  const counts = filteredRecords.reduce(
    (accumulator, record) => {
      if (record.status === "PRESENT") {
        accumulator.presentClasses += 1;
      } else if (record.status === "ABSENT") {
        accumulator.absentClasses += 1;
      } else if (record.status === "LEAVE") {
        accumulator.leaveClasses += 1;
      }

      return accumulator;
    },
    {
      presentClasses: 0,
      absentClasses: 0,
      leaveClasses: 0,
    },
  );

  const totalClasses = filteredRecords.length;
  const attendedClasses = counts.presentClasses + counts.leaveClasses;
  const overallAttendance = calculatePercentage(attendedClasses, totalClasses);

  const sortedRecords = [...filteredRecords].sort(
    (left, right) => new Date(right.date) - new Date(left.date),
  );

  let streak = 0;

  for (const record of sortedRecords) {
    if (record.status === "ABSENT") {
      break;
    }

    if (record.status === "PRESENT" || record.status === "LEAVE") {
      streak += 1;
      continue;
    }

    break;
  }

  return {
    records: filteredRecords,
    totalClasses,
    attendedClasses,
    presentClasses: counts.presentClasses,
    absentClasses: counts.absentClasses,
    leaveClasses: counts.leaveClasses,
    overallAttendance,
    streak,
  };
};

module.exports = {
  buildAttendanceSummary,
  getEligibilityStatus,
};
