import {MigrationInterface, QueryRunner, TableForeignKey, TableIndex} from "typeorm";

export class updateValidatorsHistoryIndex21685529425907 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('validators_history');
        const foreignKey = table.foreignKeys.find((index:TableForeignKey)=> JSON.stringify(index.columnNames)==JSON.stringify(['validator_id']));
        if(foreignKey)
            await queryRunner.dropForeignKey('validators_history', foreignKey.name);
        const index = table.indices.find((index:TableIndex)=> index.isUnique  && JSON.stringify(index.columnNames)==JSON.stringify(['validator_id', 'extra']));
        if(index)
            await queryRunner.dropIndex('validators_history', index.name);
        await queryRunner.createForeignKey(
            'validators_history',
            new TableForeignKey({
                columnNames: ['validator_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'validators',
                onDelete: 'CASCADE',
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
