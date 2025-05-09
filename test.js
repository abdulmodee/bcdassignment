const now = Math.floor(Date.now() / 1000);
const oneHour = 60 * 60;
const oneDay = 24 * oneHour;

const startTime = now;
const endTime = now + oneDay;

console.log(startTime);
console.log(endTime);