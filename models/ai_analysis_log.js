module.exports = (sequelize, DataTypes) => {
  const AI_Analysis_Log = sequelize.define('AI_Analysis_Log', {
    AnalysisID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    ItemID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'item',
        key: 'ItemID'
      }
    },
    Date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    Notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // New columns for AI stock report storage
    ReportType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'stock_report'
    },
    AIProvider: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    PromptText: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    RawResponse: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    ParsedSuggestions: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    SuggestedQty: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    Priority: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    Status: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: 'suggested'
    }
  }, {
    tableName: 'ai_analysis_log',
    timestamps: false
  });

  AI_Analysis_Log.associate = function(models) {
    AI_Analysis_Log.belongsTo(models.Item, {
      foreignKey: 'ItemID',
      as: 'Item'
    });
  };

  return AI_Analysis_Log;
};
