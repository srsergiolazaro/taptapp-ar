function popcount(n) {
    n = n - ((n >> 1) & 0x55555555);
    n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
    return (((n + (n >> 4)) & 0x0F0F0F0F) * 0x01010101) >> 24;
}

console.log("0x80000000:", popcount(0x80000000));
console.log("0xFFFFFFFF:", popcount(0xFFFFFFFF));
