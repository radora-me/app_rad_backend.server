const calculatePercentage = (present, total) => {

  if (!total) return 0

  return Number(
    ((present / total) * 100).toFixed(2)
  )
}

module.exports = {
  calculatePercentage
}