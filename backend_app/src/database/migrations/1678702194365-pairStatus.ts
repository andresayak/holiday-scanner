import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class pairStatus1678702194365 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns('pairs', [
            new TableColumn({
                name: 'isTested',
                type: 'bool',
                default: false,
            }),

            new TableColumn({
                name: 'isVerified',
                type: 'bool',
                default: false,
            }),

            new TableColumn({
                name: 'status',
                type: 'varchar(128)',
                isNullable: true,
            }),
        ]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
