import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class updateValidatorsHistory1685350930835 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns('validators_history', [
            new TableColumn({
                name: 'block_number',
                type: 'int(11)',
                isNullable: true,
            }),
        ]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
