"use strict";
const { Model, Op } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class sportsession extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      sportsession.belongsTo(models.Users, {
        foreignKey: "userId",
        onDelete: "CASCADE",
      });
    }
    static async addsession({
      venue,
      numberofTeams,
      numberofplayers,
      playerNames,
      time,
      userId,
      sport_name,
    }) {
      return this.create({
        venue: venue,
        teamcount: numberofTeams,
        playercount: numberofplayers,
        playernames: playerNames,
        time: time,
        userId,
        sport_name: sport_name,
      });
    }
    static async getsession(sportName) {
      return this.findAll({
        where: {
          sport_name: sportName,
        },
      });
    }
    static async getjoinedsession(loggedInUser) {
      return this.findAll({
        where: {
          joined: {
            [Op.contains]: [loggedInUser],
          },
        },
      });
    }

    static async addplayer(sessionId, playerName, loggedInUser) {
      const session = await this.findByPk(sessionId);

      if (session) {
        const existingPlayerNames = session.playernames || "";
        const playerNameLower = playerName.toLowerCase();
        session.playernames = existingPlayerNames
          ? `${existingPlayerNames},${playerName}`
          : playerNameLower;
        session.joined = session.joined || [];
        session.joined = [...session.joined, loggedInUser];
        await session.save();
        return session;
      }

      throw new Error("Session not found");
    }
  }
  sportsession.init(
    {
      venue: DataTypes.STRING,
      teamcount: DataTypes.INTEGER,
      playercount: DataTypes.INTEGER,
      playernames: DataTypes.STRING,
      time: DataTypes.DATE,
      sport_name: DataTypes.STRING,
      joined: DataTypes.ARRAY(DataTypes.INTEGER),
    },
    {
      sequelize,
      modelName: "sportsession",
    }
  );
  return sportsession;
};
