const typeorm = require("typeorm");
const dataSource = new typeorm.DataSource({
    type: "postgres",
    host: "localhost",
    port: 5432,
    username: "root",
    password: "123456",
    database: "main",
    synchronize: true,
    entities: [
        require("../../entities/Transaction"),
        require("../../entities/Token"),
        require("../../entities/Pair")
    ],
})

module.exports = dataSource;
