import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class updateTransactions1680372050645 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns('transactions', [
            new TableColumn({
                name: 'isTested',
                type: 'bool',
                default: false,
            }),
        ]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
