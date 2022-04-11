module.exports = {
    "up": "CREATE TABLE IF NOT EXISTS `usertable` (`userId` int NOT NULL AUTO_INCREMENT,`userName` varchar(45) NOT NULL,`password` varchar(100) NOT NULL,`isAdmin` tinyint DEFAULT NULL,`emailAddress` varchar(100) NOT NULL,PRIMARY KEY (`userId`))ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci",
    "down": "DROP TABLE usertable"
} 