const getEligibilityStatus = (percentage) => {

  if (percentage >= 75) {
    return 'SAFE'
  }

  if (percentage >= 60) {
    return 'WARNING'
  }

  return 'CRITICAL'
}

module.exports = {
  getEligibilityStatus
}