import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class pairFee1678634458981 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns('pairs', [
            new TableColumn({
                name: 'fee',
                type: 'int',
                isNullable: true,
            }),

            new TableColumn({
                name: 'fee_scale',
                type: 'int',
                isNullable: true,
            }),
        ]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
