import {MigrationInterface, QueryRunner, TableIndex} from "typeorm";

export class updateValidatorsHistoryIndex21685529425907 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('validators_history');
        const index = table.indices.find((index:TableIndex)=> index.isUnique  && JSON.stringify(index.columnNames)==JSON.stringify(['validator_id', 'extra']));
        await queryRunner.query("ALTER TABLE `validators_history` DROP INDEX `"+index.name+"`;")
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
