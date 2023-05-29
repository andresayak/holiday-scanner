import {MigrationInterface, QueryRunner, TableIndex} from "typeorm";

export class updateValidatorsHistoryIndex1685351515524 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createIndex(
            'validators_history',
            new TableIndex({ isUnique: true, columnNames: ['validator_id', 'extra'] })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
