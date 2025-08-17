import { IsEmail, IsNotEmpty } from 'class-validator';

export class SubscribeDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
