import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const StringModel = sequelize.define('String', {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    properties: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'strings',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['id']
      },
      {
        fields: ['properties']
      }
    ]
  });

  return StringModel;
};