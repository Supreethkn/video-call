const mysql = require("mysql")
const fs = require('fs');
const bcrypt = require("bcrypt")

const DB_HOST = 'localhost'
const DB_USER = 'root'
const DB_PASSWORD = ''
const DB_DATABASE = 'userDB'
const DB_PORT = 3306

const db = mysql.createPool({
    connectionLimit: 100,
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_DATABASE,
    port: DB_PORT
})

db.getConnection((err, connection) => {
    if (err) throw (err)
    console.log("DB connected successful: " + connection.threadId)

    // var usertable = "CREATE TABLE IF NOT EXISTS `usertable` (`userId` int NOT NULL AUTO_INCREMENT,`userName` varchar(45) NOT NULL,`password` varchar(100) NOT NULL,`isAdmin` tinyint DEFAULT NULL,`emailAddress` varchar(100) NOT NULL,PRIMARY KEY (`userId`))ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci";  
    // db.query(usertable, function (err, result) {  
    // if (err) throw err;  
    //     console.log(" UsertableTable created");  
    // });

    // var callDetails = "CREATE TABLE IF NOT EXISTS `callDetails` (`id` int NOT NULL AUTO_INCREMENT,`roomId` varchar(500) NOT NULL,`callOriginationTime` datetime NOT NULL,`callOrigin` varchar(45) NOT NULL,PRIMARY KEY (`id`))ENGINE=InnoDB AUTO_INCREMENT=101 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci";  
    // db.query(callDetails, function (err, result) {  
    // if (err) throw err;  
    //     console.log("CallDetails Table created");  
    // });

    // var auditReports = "CREATE TABLE IF NOT EXISTS `auditReports` (`id` int NOT NULL AUTO_INCREMENT,`callStartTime` datetime NOT NULL,`operatorName` varchar(45) NOT NULL,`callDuration` varchar(100) NOT NULL,`callEndTime` datetime NOT NULL,`callOrigin` varchar(500) NOT NULL,`reason` varchar(500) NOT NULL,`recording` varchar(500) DEFAULT NULL,`roomId` varchar(500) NOT NULL,PRIMARY KEY (`id`))ENGINE=InnoDB AUTO_INCREMENT=52 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci";  
    // db.query(auditReports, function (err, result) {  
    // if (err) throw err;  
    //     console.log("AuditReports Table created");  
    // });
})

// Read SQL seed query
const seedQuery = fs.readFileSync("db/seeding.sql", {
    encoding: "utf-8",
})
  
const psw = Math.random()
.toString(36)
.substring(2)
const hash = bcrypt.hashSync('admin', 10)

console.log("Running SQL seed...")

// Run seed query
db.query(seedQuery, [hash], err => {
if (err) {
  throw err
}
console.log("SQL seed completed! Password for initial admin account: " + psw)
})
