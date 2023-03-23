import {MigrationInterface, QueryRunner, TableColumn} from "typeorm";

export class tokensIsVerified1678966620613 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns('tokens', [
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
        ]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
