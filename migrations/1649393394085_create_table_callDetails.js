module.exports = {
    "up": "CREATE TABLE IF NOT EXISTS `callDetails` (`id` int NOT NULL AUTO_INCREMENT,`roomId` varchar(500) NOT NULL,`callOriginationTime` datetime NOT NULL,`callOrigin` varchar(45) NOT NULL,PRIMARY KEY (`id`))ENGINE=InnoDB AUTO_INCREMENT=101 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;",
    "down": "DROP TABLE callDetails"
}