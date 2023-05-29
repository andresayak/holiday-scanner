import {MigrationInterface, QueryRunner, TableColumn, TableIndex} from "typeorm";

export class updateValidatorsHistoryAddlastBlockNumber1685366268384 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns('validators_history', [
            new TableColumn({
                name: 'last_block_number',
                type: 'int(11)',
                isNullable: true,
            }),
        ]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
