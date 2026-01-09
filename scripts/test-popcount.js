function popcount(n) {
    n = n - ((n >> 1) & 0x55555555);
    n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
    return (((n + (n >> 4)) & 0x0F0F0F0F) * 0x01010101) >> 24;
}

console.log("0:", popcount(0));
console.log("1:", popcount(1));
console.log("0xFFFFFFFF:", popcount(0xFFFFFFFF));
console.log("0x55555555:", popcount(0x55555555));
