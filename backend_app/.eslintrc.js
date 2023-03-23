module.exports = {
    root: true,
    env: {
        es6: true,
        node: true,
    },
    extends: [],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        project: ["tsconfig.json"],
        sourceType: "module",
    },
    ignorePatterns: [
        "/dist/**/*",
    ],
    plugins: [
        "@typescript-eslint",
    ],
    rules: {
        "quotes": ["error", "double"],
        "import/no-unresolved": 0,
        "indent": ["error", 2],
    },
};
