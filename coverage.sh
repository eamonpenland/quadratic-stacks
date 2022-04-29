clarinet test --coverage
genhtml coverage.lcov -o coverage
cd coverage && open index.html